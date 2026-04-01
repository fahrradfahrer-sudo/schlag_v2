<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

$dbPath = __DIR__ . '/../../data/fields.db';
$method = $_SERVER['REQUEST_METHOD'];

try {
    $pdo = new PDO('sqlite:' . $dbPath);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    switch ($method) {
        case 'GET':
            $field_id = $_GET['field_id'] ?? null;
            $year = $_GET['year'] ?? null;

            if ($field_id && $year) {
                $stmt = $pdo->prepare("SELECT * FROM field_records WHERE field_id = ? AND year = ?");
                $stmt->execute([$field_id, $year]);
                $record = $stmt->fetch(PDO::FETCH_ASSOC);
                echo json_encode($record ?: ["field_id" => $field_id, "year" => $year]);
            } else if ($field_id) {
                $stmt = $pdo->prepare("SELECT * FROM field_records WHERE field_id = ? ORDER BY year DESC");
                $stmt->execute([$field_id]);
                $records = $stmt->fetchAll(PDO::FETCH_ASSOC);
                echo json_encode($records);
            } else {
                http_response_code(400);
                echo json_encode(["error" => "Missing field_id"]);
            }
            break;

        case 'POST':
            $data = json_decode(file_get_contents("php://input"), true);
            if (!isset($data['field_id']) || !isset($data['year'])) {
                http_response_code(400);
                echo json_encode(["error" => "Missing field_id or year"]);
                break;
            }
            $stmt = $pdo->prepare("INSERT OR REPLACE INTO field_records (field_id, year, crop, spraying, fertilizing, tilling, harvesting, seeding, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([
                $data['field_id'],
                $data['year'],
                $data['crop'] ?? '',
                $data['spraying'] ?? '',
                $data['fertilizing'] ?? '',
                $data['tilling'] ?? '',
                $data['harvesting'] ?? '',
                $data['seeding'] ?? '',
                $data['notes'] ?? ''
            ]);
            echo json_encode(["status" => "success"]);
            break;

        case 'OPTIONS':
            http_response_code(200);
            break;

        default:
            http_response_code(405);
            echo json_encode(["error" => "Method not allowed"]);
            break;
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["error" => $e->getMessage()]);
}
?>
