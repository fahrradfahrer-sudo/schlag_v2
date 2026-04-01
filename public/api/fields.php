<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

$dbPath = __DIR__ . '/../../data/fields.db';
$method = $_SERVER['REQUEST_METHOD'];

try {
    if (!file_exists(dirname($dbPath))) {
        mkdir(dirname($dbPath), 0777, true);
    }
    $pdo = new PDO('sqlite:' . $dbPath);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    switch ($method) {
        case 'GET':
            $id = $_GET['id'] ?? null;
            $year = (int)date('Y');
            if ($id) {
                $stmt = $pdo->prepare("SELECT f.id, f.name, f.geometry, f.notes, f.area, f.created_at, r.crop
                                      FROM fields f
                                      LEFT JOIN field_records r ON f.id = r.field_id AND r.year = ?
                                      WHERE f.id = ?");
                $stmt->execute([$year, $id]);
                $field = $stmt->fetch(PDO::FETCH_ASSOC);
                echo json_encode($field);
            } else {
                $stmt = $pdo->prepare("SELECT f.id, f.name, f.geometry, f.notes, f.area, f.created_at, r.crop
                                      FROM fields f
                                      LEFT JOIN field_records r ON f.id = r.field_id AND r.year = ?
                                      ORDER BY f.created_at DESC");
                $stmt->execute([$year]);
                $fields = $stmt->fetchAll(PDO::FETCH_ASSOC);
                echo json_encode($fields);
            }
            break;

        case 'POST':
            $data = json_decode(file_get_contents("php://input"), true);
            if (!isset($data['name']) || !isset($data['geometry'])) {
                http_response_code(400);
                echo json_encode(["error" => "Missing name or geometry"]);
                break;
            }
            $stmt = $pdo->prepare("INSERT INTO fields (name, geometry, notes, area) VALUES (?, ?, ?, ?)");
            $stmt->execute([
                $data['name'],
                $data['geometry'],
                $data['notes'] ?? '',
                $data['area'] ?? 0
            ]);
            echo json_encode(["id" => $pdo->lastInsertId(), "status" => "success"]);
            break;

        case 'PUT':
            $id = $_GET['id'] ?? null;
            if (!$id) {
                http_response_code(400);
                echo json_encode(["error" => "Missing ID"]);
                break;
            }
            $data = json_decode(file_get_contents("php://input"), true);
            $stmt = $pdo->prepare("UPDATE fields SET name = ?, geometry = ?, notes = ?, area = ? WHERE id = ?");
            $stmt->execute([
                $data['name'],
                $data['geometry'],
                $data['notes'] ?? '',
                $data['area'] ?? 0,
                $id
            ]);
            echo json_encode(["status" => "success"]);
            break;

        case 'DELETE':
            $id = $_GET['id'] ?? null;
            if ($id) {
                $stmt = $pdo->prepare("DELETE FROM fields WHERE id = ?");
                $stmt->execute([$id]);
            } else {
                $pdo->exec("DELETE FROM fields");
            }
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
