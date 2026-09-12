# rootstock

A yard task planner. Every task cites the rule and the reading that produced it.

## Configuration

The build reads `ROOTSTOCK_AWAY_SLUG`, the path segment the Away Card is served at. The deploy workflow takes it from a repository secret of the same name. No committed file carries it, because this repository is public and a committed slug is a published one. A build without the variable fails on purpose, since the alternative is a default slug anyone could guess.
