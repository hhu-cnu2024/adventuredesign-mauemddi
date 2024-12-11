
let ws; // WebSocket 객체
let channelId; // 채널 ID

function resetChatWindow() {
    document.getElementById("chat-window").innerHTML = "";
    document.getElementById("help-choices").innerHTML = "";
    document.getElementById("quest-container").innerHTML = "";
}
// 채널 연결 함수
function connectToChannel() {
    resetChatWindow();
    
    const newChannelId = document.getElementById("channelInput").value.trim();

    if (!newChannelId) {
        alert("채널 ID를 입력하세요.");
        return;
    }

    // 기존 WebSocket 연결 닫기 (현재 채널에 한정)
    if (ws && ws.readyState !== WebSocket.CLOSED) {
        ws.close(); // 현재 WebSocket 연결 종료
        console.log(`WebSocket 연결이 닫혔습니다: ${channelId}`);
    }

    channelId = newChannelId; // 새로운 채널 ID 설정
    // WebSocket 연결
    ws = new WebSocket(`ws://ip주소:8000//ws?channel=${channelId}`);

    ws.onopen = function () {
        console.log("WebSocket connection established.");
        document.getElementById("messageInput").disabled = false;
        document.getElementById("sendButton").disabled = false;
        document.getElementById("helpButton").disabled = false;
        document.getElementById("questButton").disabled = false;
    };

    ws.onmessage = function (event) {
        const data = JSON.parse(event.data);
        console.log("Message received:", data);

        if (data.type === "chat") {
            addMessageToWindow(data);
        } else if (data.type === "image" && data.sender !== "self") {
            displayImage(data);
        } else if (data.type === "help") {
            displayHelpChoices(data.choices);
        } else if (data.type === "quest") {
            displayQuest(data.response);
        }
    };

    ws.onerror = function (error) {
        console.error("WebSocket error:", error);
    };

    ws.onclose = function () {
        console.log("WebSocket connection closed.");
        document.getElementById("messageInput").disabled = true;
        document.getElementById("sendButton").disabled = true;
        document.getElementById("helpButton").disabled = true;
        document.getElementById("questButton").disabled = true;
    };
}



function sendMessage() {
    const input = document.getElementById("messageInput");
    const message = input.value.trim();

    if (message && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "chat", message: message, channel: channelId }));
        input.value = "";
    }
}
function sendImage() {
    const fileInput = document.getElementById("imageInput");
    const file = fileInput.files[0];

    if (file) {
        const reader = new FileReader();
        reader.onload = function (event) {
            const imageData = event.target.result;
            // WebSocket 연결 확인 및 메시지 전송
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: "image", image: imageData, channel: channelId }));
                addImageToWindow({ sender: "self", image: imageData });
            } else {
                console.error("WebSocket is not open. Cannot send image.");
            }
            
        };
        reader.readAsDataURL(file);
    }
    fileInput.value = ""; // 초기화
}

function addImageToWindow(data) {
    const chatWindow = document.getElementById("chat-window");

    const message = document.createElement("div");
    message.className = data.sender === "self" ? "message self" : "message other";

    const image = document.createElement("img");
    image.src = data.image;
    image.style.maxWidth = "200px";
    image.style.borderRadius = "8px";

    message.appendChild(image);
    chatWindow.appendChild(message);
    chatWindow.scrollTop = chatWindow.scrollHeight; // 자동 스크롤
}


// 도움 버튼 클릭 시 호출
function showHelp() {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "help" })); // 도움 요청 메시지 전송
    } else {
        console.error("WebSocket is not open. Cannot request help.");
    }
}

// 퀘스트 버튼 클릭 시 호출
function showQuest() {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "quest" })); // 퀘스트 요청 메시지 전송
    } else {
        console.error("WebSocket is not open. Cannot request quest.");
    }
}

// 채팅 메시지를 화면에 추가

function addMessageToWindow(data) {
    const chatWindow = document.getElementById("chat-window");

    const message = document.createElement("div");
    message.textContent = data.message;

    // 발신자에 따라 CSS 클래스 설정
    message.className = data.sender === "self" ? "message self" : "message other";

    chatWindow.appendChild(message);

    // 채팅창 자동 스크롤
    chatWindow.scrollTop = chatWindow.scrollHeight;
}
// 이미지 메시지를 채팅창에 추가
function displayImage(data) {
    const chatWindow = document.getElementById("chat-window");

    const message = document.createElement("div");
    const img = document.createElement("img");

    img.src = data.image; // base64 데이터 사용
    img.alt = "Sent Image";
    img.style.maxWidth = "100%";
    img.style.borderRadius = "8px";

    message.className = data.sender === "self" ? "message self" : "message other";
    message.appendChild(img);

    chatWindow.appendChild(message);
    chatWindow.scrollTop = chatWindow.scrollHeight; // 자동 스크롤
}

// 도움 선택지를 화면에 표시

function displayHelpChoices(choices) {
    const helpChoicesContainer = document.getElementById("help-choices");
    helpChoicesContainer.innerHTML = "";

    choices.forEach((choice, index) => {
        const button = document.createElement("button");
        button.textContent = `${choice}`;
        button.onclick = () => {
            ws.send(JSON.stringify({ type: "chat", message: choice, channel: channelId }));
        };
        helpChoicesContainer.appendChild(button);
    });
}

// 선택지를 메시지로 전송
function sendChoiceAsMessage(choice) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "chat", message: choice })); // 선택한 도움 메시지 전송
    }
}

// 퀘스트 결과를 화면에 표시
function displayQuest(response) {
    const questContainer = document.getElementById("quest-container");
    questContainer.innerHTML = ""; // 기존 퀘스트 초기화

    response.forEach((line) => {
        const questLine = document.createElement("div");
        questLine.textContent = line;
        questContainer.appendChild(questLine);
    });
}

// 도움 창 토글 함수
function toggleHelp() {
    const helpChoicesContainer = document.getElementById("help-choices");
    if (helpChoicesContainer.classList.contains("hidden")) {
        helpChoicesContainer.classList.remove("hidden");
        helpChoicesContainer.classList.add("shown");
    } else {
        helpChoicesContainer.classList.remove("shown");
        helpChoicesContainer.classList.add("hidden");
    }
}

// 퀘스트 창 토글 함수
function toggleQuest() {
    const questContainer = document.getElementById("quest-container");
    if (questContainer.classList.contains("hidden")) {
        questContainer.classList.remove("hidden");
        questContainer.classList.add("shown");
    } else {
        questContainer.classList.remove("shown");
        questContainer.classList.add("hidden");
    }
}

