SELECT DISTINCT
    main.conrelid::regclass AS table_name,
    substring(pg_get_constraintdef(related.oid) FROM 'REFERENCES ([^.]+)\(') AS referenced_table_name,
    main.conname AS constraint_name,
    pg_get_constraintdef(main.oid) AS unique_definition,
    pg_get_constraintdef(related.oid) AS related_fk_definition,
    kcu.column_name AS column_name
FROM
    pg_constraint as main
LEFT JOIN
    information_schema.key_column_usage AS kcu 
    ON pg_get_constraintdef(main.oid) LIKE '%' || kcu.column_name || '%'
LEFT JOIN
    pg_constraint AS related 
    ON pg_get_constraintdef(related.oid) LIKE '%' || kcu.column_name || '%'
WHERE
    main.connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    AND main.contype = 'u'
    AND kcu.column_name != 'id'
    AND pg_get_constraintdef(main.oid) != pg_get_constraintdef(related.oid);