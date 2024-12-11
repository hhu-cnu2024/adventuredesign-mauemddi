import json
import random
from fastapi import FastAPI, WebSocket, Request, Query
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.websockets import WebSocketDisconnect
import openai

# OpenAI API 설정
client = openai.OpenAI()
app = FastAPI()

# 정적 파일 제공
app.mount("/static", StaticFiles(directory="static"), name="static")

# 템플릿 디렉토리 설정
templates = Jinja2Templates(directory="templates")

# WebSocket 연결 관리
class ConnectionManager:
    def __init__(self):
        self.active_connections = {}


    async def connect(self, websocket: WebSocket, channel: str):
        if channel not in self.active_connections:
            self.active_connections[channel] = []
        await websocket.accept()
        self.active_connections[channel].append(websocket)
        print(f"WebSocket connected: {websocket} in channel {channel}")

    def disconnect(self, websocket: WebSocket, channel: str):
        if channel in self.active_connections:
            self.active_connections[channel].remove(websocket)
            if not self.active_connections[channel]:
                del self.active_connections[channel]

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        await websocket.send_text(json.dumps(message))


    async def broadcast_to_channel(self, message: dict, channel: str, sender_websocket: WebSocket):
        if channel in self.active_connections:
            for connection in self.active_connections[channel]:
                # 현재 메시지를 보낸 웹소켓과 비교
                sender = "self" if connection == sender_websocket else "other"
                # WebSocket 객체를 JSON에 포함하지 않도록 수정
                serializable_message = {k: v for k, v in message.items() if not isinstance(v, WebSocket)}
                await connection.send_text(json.dumps({**serializable_message, "sender": sender}))


manager = ConnectionManager()

# 랜덤 퀘스트 배열
quests = [
    "가상 가족 모임 플랫폼 : 생일 파티, 가상 캠핑, 퀴즈대회",
    "원격으로 함께하는 식사시간 : 공통의 레시피로 요리를 준비한 후 공유",
    "일기 공유 시스템 : 자신의 하루를 기록하고 공유",
    "테마별 가족 게임 대회 : 보드게임, 온라인 게임",
    "스마트폰 사진 첼린지 : 하루 동안 특정 주제에 맞는 사진을 찍고 공유",
    "주간 대화 주제 선정 : 특정 주제를 선정해 가족 모두가 의견을 나눔",
    "의사소통 스타일 점검 워크숍 : 서로의 대화 스타일을 인식하고 개선",
    "가족 동영상 프로젝트 : 가족의 추억을 담은 영상을 함께 제작",
    "감사 일기 : 하루 중 감사했던 순간을 가족과 함께 나누고 기록",
    "공통 취미 만들기 : 요리, 미술, DIY 프로젝트 등 정기적으로 진행",
]

# 대화 저장소
saved_chats = {}


async def query_gpt(messages):
    """GPT API 호출 함수"""
    try:
        completion = client.chat.completions.create(
            model="gpt-4o-mini",  # 사용 모델
            messages=messages,
        )
        return completion.choices[0].message.content
    except Exception as e:
        print(f"Error querying GPT: {e}")
        return "GPT 호출 중 오류가 발생했습니다."


@app.get("/")
async def get_chat_page(request: Request):
    """HTML 파일 제공"""
    return templates.TemplateResponse("index.html", {"request": request})




@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, channel: str = Query(...)):
    allowed_channels = ["마음띠00", "마음띠01", "마음띠02", "마음띠03", "마음띠04"]
    if channel not in allowed_channels:
        await websocket.close(code=1008, reason="Invalid channel ID")
        print(f"Invalid channel ID: {channel}")
        return

    await manager.connect(websocket, channel)
    print(f"Client connected to channel {channel}")
    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)

            
            if message_data["type"] == "chat":
                if channel not in saved_chats:
                    saved_chats[channel] = []
                saved_chats[channel].append({"sender": "self", "message": message_data["message"]})

                # 브로드캐스트에 sender_websocket 전달
                await manager.broadcast_to_channel(
                    {"type": "chat", "message": message_data["message"]},
                    channel,
                    sender_websocket=websocket
                )
            elif message_data["type"] == "image":
                if channel not in saved_chats:
                    saved_chats[channel] = []
                saved_chats[channel].append({"sender": "self", "image": message_data["image"]})
                # 이미지를 다른 클라이언트로 브로드캐스트
                await manager.broadcast_to_channel(
                    {"type": "image", "image": message_data["image"]},
                    channel,
                    sender_websocket = websocket
                )



            elif message_data["type"] == "help":
                #chat_history = "\n".join([f"{msg['sender']}: {msg['message']}" for msg in saved_chats.get(channel, [])])
                chat_history = "\n".join([f"{msg['sender']}: {msg['message']}" for msg in saved_chats.get(channel, []) if "message" in msg])
                messages = [
                    {"role": "system", "content": "You are a helpful assistant."},
                    {"role": "user", "content": f"대화 내역:\n{chat_history}\n\n다음 사용자의 응답으로 적절한 4가지 선택지를 \\n로 구분하여 숫자 없이 제안해주세요."}
                ]
                help_choices = await query_gpt(messages)
                await manager.send_personal_message({"type": "help", "choices": help_choices.split("\n")}, websocket)

            elif message_data["type"] == "quest":
                random_quest = random.choice(quests)
                #chat_history = "\n".join([f"{msg['sender']}: {msg['message']}" for msg in saved_chats.get(channel, [])])
                chat_history = "\n".join([f"{msg['sender']}: {msg['message']}" for msg in saved_chats.get(channel, []) if "message" in msg])
                messages = [
                    {"role": "system", "content": "You are a helpful assistant."},
                    {"role": "user", "content": f"대화 내역:\n{chat_history}\n 퀘스트: {random_quest}\n\nBig5 성격 이론에 기반한 맞춤형 사용자별 퀘스트를 작성해주세요.결과를 다음 형식으로 정리해 주세요:1. 공통퀘스트 원문 \\n 2. 사용자1 맞춤 변형 \\n 3. 사용자2 맞춤 변형"}
                ]
                quest_result = await query_gpt(messages)
                await manager.broadcast_to_channel({"type": "quest", "response": quest_result.split("\n")}, channel, websocket)

    except WebSocketDisconnect:
        manager.disconnect(websocket, channel)
        print(f"Client disconnected from channel {channel}")
