# Level 5 pinned baseline

`chapter_1_level_5.json` in this directory is a byte-for-byte copy of

    git show a1ae892:data/levels/chapter_1_level_5.json

SHA-256 `3307f072eb3fd6d83955cf5b040a44db14a19534c191348652f007a5a66a0732`.

It exists for one reason: the Level 5 redesign workflow captures the BEFORE
frames from this file, so the comparison is always against the same map even
after `data/levels/chapter_1_level_5.json` has been redesigned. It is not read
by the game and it is not a second source of truth for the level — that is
`tools/level5/author.py`.

To restore the pre-redesign level exactly:

    cp prototypes/level5/baseline/chapter_1_level_5.json data/levels/chapter_1_level_5.json

To restore the redesign:

    python3 tools/level5/author.py --write
