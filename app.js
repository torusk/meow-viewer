/**
 * Meow NFT Explorer - Premium Logic
 * Handles Blockchain interaction and robust IPFS resolution.
 */

// --- Configuration ---
const CONFIG = {
    DEFAULT_CONTRACT: "0x27188ac3AFE630d3468F532a9dD787bC412CC024",
    RPC_URL: "https://ethereum-sepolia-rpc.publicnode.com",
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
ui.contract.value = CONFIG.DEFAULT_CONTRACT;

/**
 * Switch TABS (UI Logic)
 */
function switchTab(tabId) {
    ui.tabs.forEach(t => t.classList.toggle('active', t.id === `tab-${tabId}`));
    ui.sections.forEach(s => s.classList.toggle('active', s.id === `section-${tabId}`));
    
    ui.output.innerHTML = '';
    ui.status.textContent = tabId === 'id' ? '情報を入力して検索を開始してください' : 'ウォレットを接続してください';
}

/**
 * Handle damaged On-Chain JSON
 */
function robustJSONParse(rawStr) {
    try {
        return JSON.parse(rawStr);
    } catch (e) {
        console.warn("Raw JSON is malformed. Attempting surgical repair...");
        try {
            // Fix unescaped quotes inside value strings
            let repaired = rawStr.replace(/":\s*"(.*?)"\s*(,?)\s*/g, (match, val, comma) => {
                const safeVal = val.replace(/(?<!\\)"/g, '\\"');
                return `": "${safeVal}"${comma}`;
            });
            return JSON.parse(repaired);
        } catch (e2) {
            console.error("Critical: Metatada parsing failed completely.", e2);
            throw new Error("メタデータの解析に失敗しました。コントラクトのデータを確認してください。");
        }
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
        toggleLoading(true);
        ui.output.innerHTML = '';
        ui.status.textContent = "ブロックチェーンから取得中...";

        const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
        const abi = ["function tokenURI(uint256) view returns (string)"];
        const contract = new ethers.Contract(addr, abi, provider);

        await renderNFT(contract, id);
        ui.status.textContent = "表示完了。";
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

        ui.status.textContent = count > 0 ? `${count}個のNFTがあなたのウォレットで見つかりました。` : "このコントラクトからのNFTは所有していないようです。";
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
        metadata = robustJSONParse(atob(base64Content));
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
            console.info(`[Fallback] Image failed on gateway ${gatewayAttempt-1}. Trying ${gatewayAttempt}...`);
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
    const params = new URLSearchParams(window.location.search);
    if (params.get('id')) {
        ui.tokenId.value = params.get('id');
        if (params.get('contract')) ui.contract.value = params.get('contract');
        handleSearch();
    }
});
