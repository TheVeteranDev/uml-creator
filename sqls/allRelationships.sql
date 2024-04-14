SELECT
    conrelid::regclass AS table_name,
	substring(pg_get_constraintdef(oid) FROM 'REFERENCES ([^.]+)\(') AS referenced_table_name,
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM
    pg_constraint
WHERE
    contype = 'f';
