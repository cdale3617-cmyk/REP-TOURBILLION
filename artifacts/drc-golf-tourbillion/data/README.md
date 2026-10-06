# Course geometry

`pacific-holes.json` is a curated OpenStreetMap extract, © OpenStreetMap
contributors, licensed under the Open Database License (ODbL) 1.0:
https://opendatacommons.org/licenses/odbl/1-0/
Attribution and copyright: https://www.openstreetmap.org/copyright
The data license applies to this extract, not to the application code.

Retrieved 2026-10-04 from the read-only OSM map API:
https://www.openstreetmap.org/api/0.6/map?bbox=153.099,-27.520,153.114,-27.513
Course identity and boundary:
https://www.openstreetmap.org/relation/1668736

Validation: exactly one `golf=hole` way for each ref 1–18, valid par tags,
complete referenced nodes, paths within the Pacific course boundary, and
each path's last node inside exactly one mapped `golf=green` polygon.
Matching green way IDs, in hole order:
1062717416, 1062717426, 1062719986, 1062719994, 1062720006, 1062729502,
1062729508, 1062729522, 1062734981, 1062734988, 1062734992, 1062741398,
1062741402, 1062742883, 1062717398, 1062734995, 1062742893, 1062742899.
Each hole retains its source way ID for audit and refresh.

Targets are unchanged last nodes of sourced tee-to-green playing paths,
following https://wiki.openstreetmap.org/wiki/Tag:golf%3Dhole .
They are **mapped green references, not surveyed coordinates or daily pins**.
Rendered lines are playing paths, not fairway outlines. No terrain, hazards,
green outlines, front/back targets or flag positions are invented.

The application uses this offline snapshot, not the OSM editing API at runtime.
Review numbering and green containment again before replacing the snapshot.
Only the exact seed ID and OSM relation ID are linked; matching by course name
or proximity alone could attach another course's targets.