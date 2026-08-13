# Board sounds

Two recordings of a physical Abalone set, trimmed and levelled before they got
here. They ship as-is — there is no build step between these files and
`public/audio/`, so what is in the repo is what plays.

| File | What it is | Length |
| --- | --- | --- |
| `marble-move.m4a` | marbles sliding one square | 0.127 s |
| `marble-fall.m4a` | a marble going over the rim and landing | 0.248 s |

Mono, 24 kHz AAC, under 2.2 kB each. Mono on purpose: the board has no stereo
field to place a sound in, and one channel halves the file.

## Why they are played through the Web Audio API

Every marble in a move lands at the same instant, so a five-marble shove is not
five sounds — it is the one sound, louder. `src/lib/sound.js` scales the gain by
how many marbles moved, and the top of that ladder is above unity, which an
`<audio>` element cannot do (its `volume` is capped at 1). A `GainNode` can, so
that is what plays them.

The same decoded buffer is reused for every move, which is also what keeps a
sound from being late: nothing is fetched or decoded at the moment of a move.
