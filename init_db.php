<?php
$dbPath = __DIR__ . '/data/fields.db';

try {
    $pdo = new PDO('sqlite:' . $dbPath);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec("PRAGMA foreign_keys = ON;");

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
        spraying_employee TEXT,
        bbch TEXT,
        fertilizing TEXT,
        tilling TEXT,
        harvesting TEXT,
        seeding TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (field_id) REFERENCES fields(id) ON DELETE CASCADE,
        UNIQUE(field_id, year)
    )");

    // Add new columns to field_records if they don't exist
    $recordsColsToAdd = [
        'spraying_employee' => 'TEXT',
        'bbch' => 'TEXT',
        'seeding_date' => 'TEXT',
        'fertilizing_date' => 'TEXT',
        'spraying_date' => 'TEXT',
        'tilling_date' => 'TEXT',
        'harvesting_date' => 'TEXT',
        'variety' => 'TEXT'
    ];
    foreach ($recordsColsToAdd as $col => $type) {
        try {
            $pdo->exec("ALTER TABLE field_records ADD COLUMN $col $type");
        } catch (PDOException $e) {}
    }

    // 4. Create tasks table
    $pdo->exec("CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        field_id INTEGER NOT NULL,
        year INTEGER NOT NULL,
        task_type TEXT NOT NULL,
        task_date TEXT,
        content TEXT,
        comment TEXT,
        employee TEXT,
        bbch TEXT,
        bbch_description TEXT,
        water_rate REAL,
        application_type TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (field_id) REFERENCES fields(id) ON DELETE CASCADE
    )");

    // Add new columns to tasks if they don't exist
    $tasksColsToAdd = [
        'bbch_description' => 'TEXT',
        'water_rate' => 'REAL',
        'application_type' => 'TEXT'
    ];
    foreach ($tasksColsToAdd as $col => $type) {
        try {
            $pdo->exec("ALTER TABLE tasks ADD COLUMN $col $type");
        } catch (PDOException $e) {}
    }

    // 5. Create task_products table
    $pdo->exec("CREATE TABLE IF NOT EXISTS task_products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL,
        mittelname TEXT,
        kennr TEXT,
        schadorganismus TEXT,
        verwendungszweck TEXT,
        aufwandmenge REAL,
        einheit TEXT,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    )");

    // Migration: Move existing data from field_records to tasks if tasks table is empty
    $count = $pdo->query("SELECT COUNT(*) FROM tasks")->fetchColumn();
    if ($count == 0) {
        $records = $pdo->query("SELECT * FROM field_records")->fetchAll(PDO::FETCH_ASSOC);
        foreach ($records as $r) {
            // Seeding
            if (!empty($r['seeding']) || !empty($r['seeding_date'])) {
                $stmt = $pdo->prepare("INSERT INTO tasks (field_id, year, task_type, task_date, content) VALUES (?, ?, 'seeding', ?, ?)");
                $stmt->execute([$r['field_id'], $r['year'], $r['seeding_date'], $r['seeding']]);
            }
            // Fertilizing
            if (!empty($r['fertilizing']) || !empty($r['fertilizing_date'])) {
                $stmt = $pdo->prepare("INSERT INTO tasks (field_id, year, task_type, task_date, content, bbch) VALUES (?, ?, 'fertilizing', ?, ?, ?)");
                $stmt->execute([$r['field_id'], $r['year'], $r['fertilizing_date'], $r['fertilizing'], $r['bbch']]);
            }
            // Spraying (Plant Protection)
            if (!empty($r['spraying']) || !empty($r['spraying_date'])) {
                $stmt = $pdo->prepare("INSERT INTO tasks (field_id, year, task_type, task_date, content, employee, bbch) VALUES (?, ?, 'spraying', ?, ?, ?, ?)");
                $stmt->execute([$r['field_id'], $r['year'], $r['spraying_date'], $r['spraying'], $r['spraying_employee'], $r['bbch']]);
            }
            // Tilling
            if (!empty($r['tilling']) || !empty($r['tilling_date'])) {
                $stmt = $pdo->prepare("INSERT INTO tasks (field_id, year, task_type, task_date, content) VALUES (?, ?, 'tilling', ?, ?)");
                $stmt->execute([$r['field_id'], $r['year'], $r['tilling_date'], $r['tilling']]);
            }
            // Harvesting
            if (!empty($r['harvesting']) || !empty($r['harvesting_date'])) {
                $stmt = $pdo->prepare("INSERT INTO tasks (field_id, year, task_type, task_date, content) VALUES (?, ?, 'harvesting', ?, ?)");
                $stmt->execute([$r['field_id'], $r['year'], $r['harvesting_date'], $r['harvesting']]);
            }
        }
    }

    // 5. Migration: Copy data from fields to field_records if management columns exist in fields
    $res = $pdo->query("PRAGMA table_info(fields)");
    $cols = $res->fetchAll(PDO::FETCH_COLUMN, 1);

    if (in_array('crop', $cols)) {
        $currentYear = (int)date('Y');
        $pdo->exec("INSERT OR IGNORE INTO field_records (field_id, year, crop, spraying, fertilizing, tilling, harvesting, seeding, notes)
                    SELECT id, $currentYear, crop, spraying, fertilizing, tilling, harvesting, seeding, notes FROM fields");
    }

    echo "Database and fields table initialized/updated successfully.\n";
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
