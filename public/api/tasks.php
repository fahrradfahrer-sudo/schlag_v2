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
            $id = $_GET['id'] ?? null;

            if ($id) {
                $stmt = $pdo->prepare("SELECT * FROM tasks WHERE id = ?");
                $stmt->execute([$id]);
                echo json_encode($stmt->fetch(PDO::FETCH_ASSOC));
            } else if ($field_id && $year) {
                $stmt = $pdo->prepare("SELECT * FROM tasks WHERE field_id = ? AND year = ? ORDER BY task_date DESC");
                $stmt->execute([$field_id, $year]);
                echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
            } else if ($field_id) {
                $stmt = $pdo->prepare("SELECT * FROM tasks WHERE field_id = ? ORDER BY task_date DESC");
                $stmt->execute([$field_id]);
                echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
            } else {
                http_response_code(400);
                echo json_encode(["error" => "Missing parameters"]);
            }
            break;

        case 'POST':
            $data = json_decode(file_get_contents("php://input"), true);
            if (isset($data['bulk']) && is_array($data['field_ids'])) {
                $pdo->beginTransaction();
                $stmt = $pdo->prepare("INSERT INTO tasks (field_id, year, task_type, task_date, content, comment, employee, bbch) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
                foreach ($data['field_ids'] as $fid) {
                    $stmt->execute([
                        $fid,
                        $data['year'],
                        $data['task_type'],
                        $data['task_date'],
                        $data['content'] ?? '',
                        $data['comment'] ?? '',
                        $data['employee'] ?? '',
                        $data['bbch'] ?? ''
                    ]);
                }
                $pdo->commit();
                echo json_encode(["status" => "success", "count" => count($data['field_ids'])]);
            } else {
                $stmt = $pdo->prepare("INSERT INTO tasks (field_id, year, task_type, task_date, content, comment, employee, bbch) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
                $stmt->execute([
                    $data['field_id'],
                    $data['year'],
                    $data['task_type'],
                    $data['task_date'],
                    $data['content'] ?? '',
                    $data['comment'] ?? '',
                    $data['employee'] ?? '',
                    $data['bbch'] ?? ''
                ]);
                echo json_encode(["status" => "success", "id" => $pdo->lastInsertId()]);
            }
            break;

        case 'PUT':
            $id = $_GET['id'] ?? null;
            $data = json_decode(file_get_contents("php://input"), true);
            if (!$id) {
                http_response_code(400);
                echo json_encode(["error" => "Missing ID"]);
                break;
            }
            $stmt = $pdo->prepare("UPDATE tasks SET task_date = ?, content = ?, comment = ?, employee = ?, bbch = ? WHERE id = ?");
            $stmt->execute([
                $data['task_date'],
                $data['content'] ?? '',
                $data['comment'] ?? '',
                $data['employee'] ?? '',
                $data['bbch'] ?? '',
                $id
            ]);
            echo json_encode(["status" => "success"]);
            break;

        case 'DELETE':
            $id = $_GET['id'] ?? null;
            if ($id) {
                $stmt = $pdo->prepare("DELETE FROM tasks WHERE id = ?");
                $stmt->execute([$id]);
                echo json_encode(["status" => "success"]);
            } else {
                http_response_code(400);
                echo json_encode(["error" => "Missing ID"]);
            }
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
