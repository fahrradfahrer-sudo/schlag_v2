<?php
$dbPath = __DIR__ . '/data/fields.db';

try {
    $pdo = new PDO('sqlite:' . $dbPath);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $pdo->exec("CREATE TABLE IF NOT EXISTS fields (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        geometry TEXT NOT NULL,
        notes TEXT,
        area REAL,
        crop TEXT,
        spraying TEXT,
        fertilizing TEXT,
        tilling TEXT,
        harvesting TEXT,
        seeding TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");

    // Add columns if they don't exist (for migration)
    $colsToAdd = [
        'area' => 'REAL',
        'crop' => 'TEXT',
        'spraying' => 'TEXT',
        'fertilizing' => 'TEXT',
        'tilling' => 'TEXT',
        'harvesting' => 'TEXT',
        'seeding' => 'TEXT'
    ];

    foreach ($colsToAdd as $col => $type) {
        try {
            $pdo->exec("ALTER TABLE fields ADD COLUMN $col $type");
        } catch (PDOException $e) {
            // Likely column already exists
        }
    }

    echo "Database and fields table initialized/updated successfully.\n";
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
