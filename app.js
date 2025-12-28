/**
 * Meow NFT Explorer - Premium Logic
 * Handles Blockchain interaction and robust IPFS resolution.
 */

// --- Configuration ---
const NETWORKS = {
    polygon: {
        name: "Polygon",
        chainId: "0x89",
        rpc: "https://polygon-rpc.com",
        defaultContract: "0x27188ac3AFE630d3468F532a9dD787bC412CC024" // TODO: Change if Polygon contract is different
    },
    sepolia: {
        name: "Sepolia",
        chainId: "0xaa36a7",
        rpc: "https://ethereum-sepolia-rpc.publicnode.com",
        defaultContract: "0x27188ac3AFE630d3468F532a9dD787bC412CC024"
    }
};

let currentNet = "polygon";

const CONFIG = {
    IPFS_GATEWAYS: [
        "https://gateway.pinata.cloud/ipfs/",
        "https://cloudflare-ipfs.com/ipfs/",
        "https://ipfs.io/ipfs/",
        "https://dweb.link/ipfs/"
    ]
};

// --- DOM Elements ---
const ui = {
    contract: document.getElementById('contract-input'),
    tokenId: document.getElementById('id-input'),
    btnSearch: document.getElementById('btn-search'),
    btnConnect: document.getElementById('btn-connect'),
    status: document.getElementById('status-area'),
    loader: document.getElementById('loader'),
    output: document.getElementById('nft-output-area'),
    tabs: document.querySelectorAll('.tab-btn'),
    sections: document.querySelectorAll('.view-section')
};

// --- Initialization ---
function init() {
    // Default to 'id' tab which uses Sepolia
    currentNet = "sepolia";
    ui.contract.value = NETWORKS[currentNet].defaultContract;
}

/**
 * Switch TABS (UI Logic)
 */
function switchTab(tabId) {
    ui.tabs.forEach(t => t.classList.toggle('active', t.id === `tab-${tabId}`));
    ui.sections.forEach(s => s.classList.toggle('active', s.id === `section-${tabId}`));

    ui.output.innerHTML = '';

    // Auto-switch network context based on tab
    if (tabId === 'id') {
        currentNet = 'sepolia';
        ui.status.textContent = 'Sepolia ネットワークで検索します';
    } else {
        currentNet = 'polygon';
        ui.status.textContent = 'Polygon ネットワークに接続します';
    }

    ui.contract.value = NETWORKS[currentNet].defaultContract;
}

/**
 * Handle damaged On-Chain JSON
 */
/**
 * 破損した JSON を可能な限り修復してパースする
 */
function robustJSONParse(rawStr) {
    try {
        return JSON.parse(rawStr);
    } catch (e) {
        console.warn("Raw JSON is malformed. Attempting surgical repair...");
        try {
            // 1. 改行コードをエスケープに変換
            let repaired = rawStr.replace(/\n/g, "\\n").replace(/\r/g, "\\r");

            // 2. キー（name, description, image等）を基準に、その中身（値）を抽出して
            // 値の中に含まれる生の引用符 (") をエスケープ (\") に置換します。
            // キーの直後の引用符と、カンマや閉じ括弧の直前の引用符を「境界」として認識します。
            repaired = repaired.replace(/"(name|description|image)":\s*"([\s\S]*?)"(?=\s*(,\s*"(name|description|image|attributes)"|\s*\}))/g, (match, key, val) => {
                // 値の中にある「エスケープされていない引用符」をエスケープ
                const safeVal = val.replace(/(?<!\\)"/g, '\\"');
                return `"${key}": "${safeVal}"`;
            });

            console.log("Repaired JSON:", repaired);
            return JSON.parse(repaired);
        } catch (e2) {
            console.error("Advanced repair failed.", e2);
            throw new Error("メタデータの解析に失敗しました。説明文の引用符などが原因の可能性があります。");
        }
    }
}

/**
 * Base64データを安全にUTF-8文字列としてデコードする
 */
function decodeBase64(base64) {
    try {
        const binString = atob(base64);
        const bytes = Uint8Array.from(binString, (m) => m.codePointAt(0));
        return new TextDecoder().decode(bytes);
    } catch (e) {
        return atob(base64); // フォールバック
    }
}

/**
 * Resolves IPFS to Gateway URL with fallback support
 */
function resolveIPFS(uri, gatewayIndex = 0) {
    if (!uri || !uri.startsWith('ipfs://')) return uri;
    const cid = uri.replace('ipfs://', '');
    return CONFIG.IPFS_GATEWAYS[gatewayIndex % CONFIG.IPFS_GATEWAYS.length] + cid;
}

/**
 * Search NFT by ID
 */
async function handleSearch() {
    const addr = ui.contract.value.trim();
    const id = ui.tokenId.value;

    if (!addr || id === "") {
        ui.status.textContent = "有効なアドレスとIDを入力してください。";
        return;
    }

    try {
        ui.status.textContent = "ブロックチェーンから取得中...";
        toggleLoading(true);
        ui.output.innerHTML = '';

        const provider = new ethers.JsonRpcProvider(NETWORKS[currentNet].rpc);
        const abi = ["function tokenURI(uint256) view returns (string)"];
        const contract = new ethers.Contract(addr, abi, provider);

        await renderNFT(contract, id);
        ui.status.textContent = "";
    } catch (err) {
        ui.status.textContent = "エラー: " + (err.reason || err.message);
    } finally {
        toggleLoading(false);
    }
}

/**
 * Scan User Wallet
 */
async function handleWalletConnection() {
    if (!window.ethereum) {
        alert("MetaMask (またはEVM互換ウォレット) が見つかりません。ブラウザ拡張機能を確認してください。");
        return;
    }

    try {
        toggleLoading(true);
        ui.output.innerHTML = '';
        ui.status.textContent = "ウォレットに接続中...";

        const browserProvider = new ethers.BrowserProvider(window.ethereum);

        // --- Network Check & Switch ---
        const network = await browserProvider.getNetwork();
        const expectedChainId = NETWORKS[currentNet].chainId;

        if ("0x" + network.chainId.toString(16) !== expectedChainId) {
            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: expectedChainId }],
                });
            } catch (switchError) {
                // This error code indicates that the chain has not been added to MetaMask.
                if (switchError.code === 4902) {
                    ui.status.textContent = `${NETWORKS[currentNet].name} ネットワークをMetaMaskに追加してください。`;
                } else {
                    ui.status.textContent = `ネットワークの切り替えに失敗しました: ${switchError.message}`;
                }
                toggleLoading(false);
                return;
            }
        }

        const accounts = await browserProvider.send("eth_requestAccounts", []);
        const userAddress = accounts[0];
        const contractAddress = ui.contract.value.trim();

        ui.status.textContent = `所有権を確認中 (ID 0-20)...`;

        const abi = [
            "function tokenURI(uint256) view returns (string)",
            "function ownerOf(uint256) view returns (address)"
        ];
        const contract = new ethers.Contract(contractAddress, abi, browserProvider);

        let count = 0;
        for (let i = 0; i <= 20; i++) {
            try {
                const owner = await contract.ownerOf(i);
                if (owner.toLowerCase() === userAddress.toLowerCase()) {
                    await renderNFT(contract, i);
                    count++;
                }
            } catch (e) {
                // Ignore tokens that don't exist
            }
        }

        ui.status.textContent = count > 0 ? "" : "このコントラクトからのNFTは所有していないようです。";
    } catch (err) {
        ui.status.textContent = "接続エラー: " + err.message;
    } finally {
        toggleLoading(false);
    }
}

/**
 * Fetch Metadata and Render Card
 */
async function renderNFT(contract, id) {
    const uri = await contract.tokenURI(id);
    let metadata;

    // 1. Fetch JSON (On-Chain or IPFS)
    if (uri.startsWith('data:')) {
        const base64Content = uri.split(',')[1];
        metadata = robustJSONParse(decodeBase64(base64Content));
    } else {
        const response = await fetch(resolveIPFS(uri));
        metadata = robustJSONParse(await response.text());
    }

    // 2. Build Card
    const card = document.createElement('div');
    card.className = 'nft-card';

    const cid = (metadata.image || "").replace('ipfs://', '');
    const firstGateway = resolveIPFS(metadata.image, 0);

    card.innerHTML = `
        <div class="nft-image-box">
            <img src="${firstGateway}" alt="Meow NFT" data-cid="${cid}">
        </div>
        <div class="nft-title">${metadata.name || 'Untitled Meow'}</div>
        <div class="nft-description">${metadata.description || 'No description found.'}</div>
        <div class="nft-footer">
            <span class="badge">Meow Original</span>
            <span class="token-id-text">Token ID #${id}</span>
        </div>
    `;

    // 3. Robust Image Loading (Automatic Gateway Fallback)
    const img = card.querySelector('img');
    let gatewayAttempt = 0;

    img.onerror = () => {
        gatewayAttempt++;
        if (gatewayAttempt < CONFIG.IPFS_GATEWAYS.length) {
            console.info(`[Fallback] Image failed on gateway ${gatewayAttempt - 1}. Trying ${gatewayAttempt}...`);
            img.src = CONFIG.IPFS_GATEWAYS[gatewayAttempt] + cid;
        } else {
            console.error("All IPFS gateways failed to resolve image.");
            img.src = "https://placehold.co/600x600/f8fafc/94a3b8?text=Image+Load+Error";
            img.onerror = null; // Prevent infinite loop
        }
    };

    ui.output.appendChild(card);
}

function toggleLoading(active) {
    ui.loader.style.display = active ? 'block' : 'none';
    ui.btnSearch.disabled = active;
    ui.btnConnect.disabled = active;
}

// --- Event Listeners ---
ui.btnSearch.addEventListener('click', handleSearch);
ui.btnConnect.addEventListener('click', handleWalletConnection);

// Support for deep links (e.g., index.html?id=1&contract=0x...)
window.addEventListener('load', () => {
    init();
    const params = new URLSearchParams(window.location.search);
    if (params.get('id')) {
        ui.tokenId.value = params.get('id');
        if (params.get('contract')) ui.contract.value = params.get('contract');
        handleSearch();
    }
});
