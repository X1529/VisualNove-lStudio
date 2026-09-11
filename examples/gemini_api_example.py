# ตัวอย่าง #2 — Gemini API (fix: BaseModel + genai.configure เท่านั้น)
# ต้องติดตั้ง: pip install google-generativeai pydantic

import google.generativeai as genai
from pydantic import BaseModel
from typing import List, Optional
import os

# ── 1. กำหนด Schema ให้ response_schema ใช้งานได้จริง ──
class Line(BaseModel):
    speaker: str  # "center" | "left" | "right"
    name: str
    identity: str = ""
    text: str
    bg: Optional[int] = None
    bgm: Optional[int] = None
    sfx: Optional[int] = None
    characters: List[dict] = []
    flash: bool = False
    flashDuration: int = 400
    shake: bool = False
    shakeType: str = "shake-horizontal"
    shakeDuration: int = 300

class Choice(BaseModel):
    text: str
    next: Optional[int] = None

class VisualNovelData(BaseModel):
    lines: List[Line]
    choices: List[Choice] = []

# ── 2. ตั้งค่า API Key ผ่าน genai.configure() เท่านั้น ──
# ห้าม hardcode ใน prompt / url — อ่านจาก env จะปลอดภัยกว่า
# export GEMINI_API_KEY="AIzaSy..."
api_key = os.getenv("GEMINI_API_KEY") or "ใส่_API_KEY_ของคุณที่นี่"
genai.configure(api_key=api_key)

# ── 3. สร้างโมเดล บังคับ JSON ตาม Schema ──
model = genai.GenerativeModel(
    model_name="gemini-1.5-flash",
    generation_config={
        "response_mime_type": "application/json",
        "response_schema": VisualNovelData,
    }
)

# ── 4. Prompt ──
prompt = """
จงแต่งเนื้อเรื่องเกม Visual Novel แนวสืบสวนผสมแฟนตาซีในโรงเรียน
โดยเริ่มฉากแรก (scene_01) ที่ผู้เล่นพบสมุดบันทึกเวทมนตร์ตกอยู่ที่ดาดฟ้าโรงเรียน
และให้มีตัวเลือกอย่างน้อย 2 ทางเลือก แตกกิ่งออกไปอีกอย่างน้อยฉากละ 1 ขั้น (รวมทั้งหมดมีประมาณ 3-4 ฉาก)
ใช้ภาษาไทยในการแต่งบทสนทนาและคำบรรยายทั้งหมด
"""

# ── 5. ยิง API ──
response = model.generate_content(prompt)

# ── 6. ผลลัพธ์ JSON สะอาดพร้อมใช้งาน ──
print(response.text)
# ถ้าต้องการเป็น dict: data = VisualNovelData.model_validate_json(response.text)
