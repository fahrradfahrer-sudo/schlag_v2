<?php
$dbPath = __DIR__ . '/data/fields.db';

try {
    $pdo = new PDO('sqlite:' . $dbPath);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // 1. Create fields table if it doesn't exist
    $pdo->exec("CREATE TABLE IF NOT EXISTS fields (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        geometry TEXT NOT NULL,
        notes TEXT,
        area REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");

    // 2. Migration: Add columns to fields if they don't exist
    $colsToAdd = [
        'area' => 'REAL',
        'notes' => 'TEXT'
    ];

    foreach ($colsToAdd as $col => $type) {
        try {
            $pdo->exec("ALTER TABLE fields ADD COLUMN $col $type");
        } catch (PDOException $e) {
            // Column already exists
        }
    }

    // 3. Create field_records table
    $pdo->exec("CREATE TABLE IF NOT EXISTS field_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        field_id INTEGER NOT NULL,
        year INTEGER NOT NULL,
        crop TEXT,
        spraying TEXT,
        fertilizing TEXT,
        tilling TEXT,
        harvesting TEXT,
        seeding TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (field_id) REFERENCES fields(id) ON DELETE CASCADE,
        UNIQUE(field_id, year)
    )");

    // 4. Migration: Copy data from fields to field_records if management columns exist in fields
    $res = $pdo->query("PRAGMA table_info(fields)");
    $cols = $res->fetchAll(PDO::FETCH_COLUMN, 1);

    if (in_array('crop', $cols)) {
        $currentYear = (int)date('Y');
        $pdo->exec("INSERT OR IGNORE INTO field_records (field_id, year, crop, spraying, fertilizing, tilling, harvesting, seeding, notes)
                    SELECT id, $currentYear, crop, spraying, fertilizing, tilling, harvesting, seeding, notes FROM fields");

        // Optionally drop columns from fields table.
        // In SQLite this requires creating a new table and copying data.
        // For simplicity, we just leave them there but they won't be used by the new API.
    }

    echo "Database and fields table initialized/updated successfully.\n";
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
