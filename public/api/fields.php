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
            $stmt = $pdo->query("SELECT * FROM fields ORDER BY created_at DESC");
            $fields = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode($fields);
            break;

        case 'POST':
            $data = json_decode(file_get_contents("php://input"), true);
            if (!isset($data['name']) || !isset($data['geometry'])) {
                http_response_code(400);
                echo json_encode(["error" => "Missing name or geometry"]);
                break;
            }
            $stmt = $pdo->prepare("INSERT INTO fields (name, geometry, notes) VALUES (?, ?, ?)");
            $stmt->execute([$data['name'], $data['geometry'], $data['notes'] ?? '']);
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
            $stmt = $pdo->prepare("UPDATE fields SET name = ?, geometry = ?, notes = ? WHERE id = ?");
            $stmt->execute([$data['name'], $data['geometry'], $data['notes'] ?? '', $id]);
            echo json_encode(["status" => "success"]);
            break;

        case 'DELETE':
            $id = $_GET['id'] ?? null;
            if (!$id) {
                http_response_code(400);
                echo json_encode(["error" => "Missing ID"]);
                break;
            }
            $stmt = $pdo->prepare("DELETE FROM fields WHERE id = ?");
            $stmt->execute([$id]);
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
