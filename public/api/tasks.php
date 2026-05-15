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
                $task = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($task) {
                    $stmt = $pdo->prepare("SELECT * FROM task_products WHERE task_id = ?");
                    $stmt->execute([$id]);
                    $task['products'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
                }
                echo json_encode($task);
            } else if ($field_id && $year) {
                $stmt = $pdo->prepare("SELECT * FROM tasks WHERE field_id = ? AND year = ? ORDER BY task_date DESC");
                $stmt->execute([$field_id, $year]);
                $tasks = $stmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($tasks as &$task) {
                    $stmt = $pdo->prepare("SELECT * FROM task_products WHERE task_id = ?");
                    $stmt->execute([$task['id']]);
                    $task['products'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
                }
                echo json_encode($tasks);
            } else if ($field_id) {
                $stmt = $pdo->prepare("SELECT * FROM tasks WHERE field_id = ? ORDER BY task_date DESC");
                $stmt->execute([$field_id]);
                $tasks = $stmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($tasks as &$task) {
                    $stmt = $pdo->prepare("SELECT * FROM task_products WHERE task_id = ?");
                    $stmt->execute([$task['id']]);
                    $task['products'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
                }
                echo json_encode($tasks);
            } else {
                http_response_code(400);
                echo json_encode(["error" => "Missing parameters"]);
            }
            break;

        case 'POST':
            $data = json_decode(file_get_contents("php://input"), true);
            if (isset($data['bulk']) && is_array($data['field_ids'])) {
                $pdo->beginTransaction();
                $stmt = $pdo->prepare("INSERT INTO tasks (field_id, year, task_type, task_date, content, comment, employee, bbch, bbch_description, water_rate, application_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                $prodStmt = $pdo->prepare("INSERT INTO task_products (task_id, mittelname, kennr, schadorganismus, verwendungszweck, aufwandmenge, einheit) VALUES (?, ?, ?, ?, ?, ?, ?)");
                foreach ($data['field_ids'] as $fid) {
                    $stmt->execute([
                        $fid,
                        $data['year'],
                        $data['task_type'],
                        $data['task_date'],
                        $data['content'] ?? '',
                        $data['comment'] ?? '',
                        $data['employee'] ?? '',
                        $data['bbch'] ?? '',
                        $data['bbch_description'] ?? '',
                        $data['water_rate'] ?? null,
                        $data['application_type'] ?? null
                    ]);
                    $taskId = $pdo->lastInsertId();
                    if (isset($data['products']) && is_array($data['products'])) {
                        foreach ($data['products'] as $p) {
                            $prodStmt->execute([
                                $taskId,
                                $p['mittelname'] ?? '',
                                $p['kennr'] ?? '',
                                $p['schadorganismus'] ?? '',
                                $p['verwendungszweck'] ?? '',
                                $p['aufwandmenge'] ?? null,
                                $p['einheit'] ?? ''
                            ]);
                        }
                    }
                }
                $pdo->commit();
                echo json_encode(["status" => "success", "count" => count($data['field_ids'])]);
            } else {
                $pdo->beginTransaction();
                $stmt = $pdo->prepare("INSERT INTO tasks (field_id, year, task_type, task_date, content, comment, employee, bbch, bbch_description, water_rate, application_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                $stmt->execute([
                    $data['field_id'],
                    $data['year'],
                    $data['task_type'],
                    $data['task_date'],
                    $data['content'] ?? '',
                    $data['comment'] ?? '',
                    $data['employee'] ?? '',
                    $data['bbch'] ?? '',
                    $data['bbch_description'] ?? '',
                    $data['water_rate'] ?? null,
                    $data['application_type'] ?? null
                ]);
                $taskId = $pdo->lastInsertId();
                if (isset($data['products']) && is_array($data['products'])) {
                    $prodStmt = $pdo->prepare("INSERT INTO task_products (task_id, mittelname, kennr, schadorganismus, verwendungszweck, aufwandmenge, einheit) VALUES (?, ?, ?, ?, ?, ?, ?)");
                    foreach ($data['products'] as $p) {
                        $prodStmt->execute([
                            $taskId,
                            $p['mittelname'] ?? '',
                            $p['kennr'] ?? '',
                            $p['schadorganismus'] ?? '',
                            $p['verwendungszweck'] ?? '',
                            $p['aufwandmenge'] ?? null,
                            $p['einheit'] ?? ''
                        ]);
                    }
                }
                $pdo->commit();
                echo json_encode(["status" => "success", "id" => $taskId]);
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
            $pdo->beginTransaction();
            $stmt = $pdo->prepare("UPDATE tasks SET task_date = ?, content = ?, comment = ?, employee = ?, bbch = ?, bbch_description = ?, water_rate = ?, application_type = ? WHERE id = ?");
            $stmt->execute([
                $data['task_date'],
                $data['content'] ?? '',
                $data['comment'] ?? '',
                $data['employee'] ?? '',
                $data['bbch'] ?? '',
                $data['bbch_description'] ?? '',
                $data['water_rate'] ?? null,
                $data['application_type'] ?? null,
                $id
            ]);

            // Update products (delete and re-insert for simplicity)
            $pdo->prepare("DELETE FROM task_products WHERE task_id = ?")->execute([$id]);
            if (isset($data['products']) && is_array($data['products'])) {
                $prodStmt = $pdo->prepare("INSERT INTO task_products (task_id, mittelname, kennr, schadorganismus, verwendungszweck, aufwandmenge, einheit) VALUES (?, ?, ?, ?, ?, ?, ?)");
                foreach ($data['products'] as $p) {
                    $prodStmt->execute([
                        $id,
                        $p['mittelname'] ?? '',
                        $p['kennr'] ?? '',
                        $p['schadorganismus'] ?? '',
                        $p['verwendungszweck'] ?? '',
                        $p['aufwandmenge'] ?? null,
                        $p['einheit'] ?? ''
                    ]);
                }
            }
            $pdo->commit();
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
