<?php
header("Content-Type: application/json");

$query = $_GET['q'] ?? '';
$kennr = $_GET['kennr'] ?? '';

if ($kennr) {
    // Fetch details for a specific product
    $base_url = "https://psm-api.bvl.bund.de/ords/psm/api-v1/";

    function fetch_api($url) {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        $response = curl_exec($ch);
        curl_close($ch);
        return json_decode($response, true);
    }

    $q_kennr = urlencode(json_encode(["kennr" => $kennr]));
    $q_ebene = urlencode(json_encode(["ebene" => $kennr]));

    $mittel = fetch_api($base_url . "mittel/?q=" . $q_kennr);
    $auflagen = fetch_api($base_url . "auflagen/?q=" . $q_ebene);
    $awg = fetch_api($base_url . "awg/?q=" . $q_kennr);

    $bee_safety = "N/A";
    if (isset($auflagen['items'])) {
        foreach ($auflagen['items'] as $item) {
            if (isset($item['auflage']) && strpos($item['auflage'], 'NB') === 0) {
                $bee_safety = $item['auflage'];
                break;
            }
        }
    }

    $rates = [];
    if (isset($awg['items'])) {
        // Just take the first few to avoid too much data
        $first_awgs = array_slice($awg['items'], 0, 3);
        foreach ($first_awgs as $a) {
            $awg_id = $a['awg_id'];
            $q_awg = urlencode(json_encode(["awg_id" => $awg_id]));
            $aufwand = fetch_api($base_url . "awg_aufwand/?q=" . $q_awg);
            if (isset($aufwand['items'][0])) {
                $item = $aufwand['items'][0];
                $rates[] = [
                    "amount" => $item['m_aufwand'],
                    "unit" => $item['m_aufwand_einheit']
                ];
            }
        }
    }

    echo json_encode([
        "mittel" => $mittel['items'][0] ?? null,
        "bee_safety" => $bee_safety,
        "rates" => $rates
    ]);
    exit;
}

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
$response = curl_exec($ch);
curl_close($ch);

echo $response;
?>
