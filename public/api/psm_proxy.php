<?php
header("Content-Type: application/json");

$query = $_GET['q'] ?? '';
if (!$query) {
    echo json_encode(["items" => []]);
    exit;
}

// PSM-API supports $instr for substring search
$api_url = "https://psm-api.bvl.bund.de/ords/psm/api-v1/mittel/?q=" . urlencode(json_encode(["mittelname" => ["\$instr" => $query]]));

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $api_url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 10);
// The PSM-API seems to allow all origins based on previous curl -I check
$response = curl_exec($ch);
curl_close($ch);

echo $response;
?>
