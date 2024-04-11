import pg from "pg";

export const getPostgresSchema = async (user, password, host, port, database) => {
    const pool = new pg.Pool({
        user: user,
        password: password,
        host: host,
        port: port,
        database: database,
    });

    await pool.connect();

    const tableQuery = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'";

    const tableResults = await pool.query(tableQuery);

    const tables = tableResults.rows.map(row => row.table_name);

    const tableMap = new Map();

    for (const t of tables) {
        const columnQuery = "SELECT c.column_name, c.data_type, kcu.constraint_name " +
            "FROM information_schema.columns c " +
            "LEFT JOIN information_schema.key_column_usage kcu " +
            "ON c.table_name = kcu.table_name AND c.column_name = kcu.column_name " +
            "WHERE c.table_name = '" + t + "' " +
            "ORDER BY c.column_name";

        const columnResults = await pool.query(columnQuery);

        const columns = columnResults.rows.map(row => ({
            column_name: row.column_name,
            data_type: row.data_type.replaceAll(" ", "_"),
            isPrimaryKey: row.constraint_name !== null && row.constraint_name.includes("pkey")
        }));

        tableMap.set(t, columns);
    }

    pool.end();

    return tableMap;
};

