"""Banana cube (2x2x3 cuboid) solver: a Python port of the solver in web/src/pages/more/banana-cube.astro.

States are integers in [0, 1_935_360): corner permutation (8!) x middle-piece
permutation (4!) x one shared middle-piece orientation bit. Indices match
the website's solver exactly, so a state from the notebook means the same thing on the site.

    import banana
    B = banana.load()           # builds (~1s) or reads the cached tables
    B.dist[s]                   # exact moves-to-solved for state s
    B.step(s, m)                # apply move m (vectorised over arrays)
"""
from itertools import permutations
from math import factorial
from pathlib import Path

import numpy as np

CORNER_HOME = [(-1, 2, -1), (1, 2, -1), (1, 2, 1), (-1, 2, 1),
               (-1, -2, -1), (1, -2, -1), (1, -2, 1), (-1, -2, 1)]
EDGE_HOME = [(-1, 0, -1), (1, 0, -1), (1, 0, 1), (-1, 0, 1)]
HOME = CORNER_HOME + EDGE_HOME

NC, NE = factorial(8), factorial(4) * 2
N = NC * NE
UNSOLVED = 255

_STEP = {
    "x": np.array([[1, 0, 0], [0, 0, -1], [0, 1, 0]]),
    "y": np.array([[0, 0, 1], [0, 1, 0], [-1, 0, 0]]),
    "z": np.array([[0, -1, 0], [1, 0, 0], [0, 0, 1]]),
}


def rot(axis, q):
    return np.linalg.matrix_power(_STEP[axis], q % 4)


_LAYER = {
    "U": lambda p: p[1] == 2, "E": lambda p: p[1] == 0, "D": lambda p: p[1] == -2,
    "R": lambda p: p[0] == 1, "L": lambda p: p[0] == -1,
    "F": lambda p: p[2] == 1, "B": lambda p: p[2] == -1,
}

# Same order as the website's solver: U U' U2 E E' E2 D D' D2 R2 L2 F2 B2
MOVES = []
for face, base in [("U", -1), ("E", 1), ("D", 1)]:
    MOVES += [(face, "y", base, face), (face + "'", "y", -base, face), (face + "2", "y", 2, face)]
for face, axis in [("R", "x"), ("L", "x"), ("F", "z"), ("B", "z")]:
    MOVES.append((face + "2", axis, 2, face))
MOVE_NAMES = [m[0] for m in MOVES]
NM = len(MOVES)


def _symmetries():
    """The 8 ways to hold the cuboid."""
    group = [np.eye(3, dtype=int)]
    for g in group:
        for h in (rot("y", 1) @ g, rot("x", 2) @ g):
            if not any((h == k).all() for k in group):
                group.append(h)
    return group


D4 = _symmetries()


def _rank_rows(perms):
    """Lehmer rank of each row; matches itertools.permutations order."""
    n = perms.shape[1]
    r = np.zeros(len(perms), dtype=np.int64)
    for i in range(n):
        smaller = (perms[:, i + 1:] < perms[:, [i]]).sum(axis=1)
        r += smaller * factorial(n - 1 - i)
    return r


def _slot_dest(slots, name, axis, q, face):
    M = rot(axis, q)
    out = []
    for p in slots:
        t = tuple(M @ p) if _LAYER[face](p) else p
        out.append(slots.index(t))
    return np.array(out)


def to_index(mats):
    """Index of a state given as 12 rotation matrices (one per piece)."""
    cp, ep = [0] * 8, [0] * 4
    for i in range(8):
        cp[CORNER_HOME.index(tuple(mats[i] @ HOME[i]))] = i
    for i in range(4):
        ep[EDGE_HOME.index(tuple(mats[8 + i] @ HOME[8 + i]))] = i
    flip = int(mats[8][0, 0] == 0)
    return int(_rank_rows(np.array([cp]))[0] * NE + _rank_rows(np.array([ep]))[0] * 2 + flip)


class Banana:
    def __init__(self, c_tab, e_tab, dist):
        self.c_tab, self.e_tab, self.dist = c_tab, e_tab, dist
        self.max_depth = int(dist.max())
        # each position is counted 8 times (once per way of holding it)
        self.counts = np.bincount(dist, minlength=self.max_depth + 1)
        self.depth_share = self.counts / self.counts.sum()

    def step(self, s, m):
        """Apply move index m to state(s) s. Both may be arrays."""
        s = np.asarray(s, dtype=np.int64)
        return self.c_tab[s // NE, m].astype(np.int64) * NE + self.e_tab[s % NE, m]

    def solution(self, s):
        path = []
        while self.dist[s] > 0:
            for m in range(NM):
                t = int(self.step(s, m))
                if self.dist[t] == self.dist[s] - 1:
                    path.append(MOVE_NAMES[m])
                    s = t
                    break
        return path


def build():
    corners = np.array(list(permutations(range(8))), dtype=np.int8)
    edges = np.array(list(permutations(range(4))), dtype=np.int8)
    c_tab = np.empty((NC, NM), dtype=np.int32)
    e_tab = np.empty((NE, NM), dtype=np.int32)
    for m, (name, axis, q, face) in enumerate(MOVES):
        d = _slot_dest(CORNER_HOME, name, axis, q, face)
        moved = np.empty_like(corners)
        moved[:, d] = corners
        c_tab[:, m] = _rank_rows(moved)

        d = _slot_dest(EDGE_HOME, name, axis, q, face)
        moved = np.empty_like(edges)
        moved[:, d] = edges
        toggle = int(face == "E" and abs(q) == 1)
        er = _rank_rows(moved)
        c = np.arange(NE)
        e_tab[:, m] = er[c >> 1] * 2 + ((c & 1) ^ toggle)

    # breadth-first search out from "solved", however you hold it
    dist = np.full(N, UNSOLVED, dtype=np.uint8)
    frontier = np.unique([to_index([g] * 12) for g in D4]).astype(np.int64)
    dist[frontier] = 0
    depth = 0
    while len(frontier):
        depth += 1
        nxt = (c_tab[frontier // NE].astype(np.int64) * NE + e_tab[frontier % NE]).ravel()
        nxt = np.unique(nxt)
        nxt = nxt[dist[nxt] == UNSOLVED]
        dist[nxt] = depth
        frontier = nxt
    return Banana(c_tab, e_tab, dist)


def load(cache=Path(__file__).with_name(".banana_tables.npz")):
    cache = Path(cache)
    if cache.exists():
        z = np.load(cache)
        return Banana(z["c_tab"], z["e_tab"], z["dist"])
    b = build()
    np.savez_compressed(cache, c_tab=b.c_tab, e_tab=b.e_tab, dist=b.dist)
    return b
