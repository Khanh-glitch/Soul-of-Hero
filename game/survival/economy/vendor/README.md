# Pinned first-party A3 adapter

`a3_economy_service.gd` is an unmodified copy of A3 PR #19 commit
`86dc21954fd0a1a4aa9f98b6ec7d1e6782cc800e`, SHA-256
`b1ee9792b4460e956ec6c59437269078e4f6767f76d35145e680dcc03ba3806c`.
The five A3 catalogs under `data/survival/items/` and `recipes/` are byte-exact
copies of the same pin. Their adapter/catalog bytes and active-tick contract
were rechecked at A3 head `18e7afcbd576bbd9bfbcc509b2ee13216186a522`; later
product-model and A1 adoption records are not included or claimed integrated.
A0's separately owned `a0_economy_adapter.gd` restricts mutation callbacks; it
is source-hash pinned in SaveService. Future A3 version changes require joint
review and pin updates. The A3 branch is not changed. Gold remains blocked.
