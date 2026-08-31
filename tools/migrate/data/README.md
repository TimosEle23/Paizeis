# Export drop zone

`export.json` goes here — the output of the SQL-editor query in
`../queries/export.sql`, run against the Lovable Cloud database.

**It contains bcrypt password hashes and every user's email address.** It is
gitignored and must stay that way. Delete it once the migration has been run
and verified.
