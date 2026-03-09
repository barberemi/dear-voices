import os
import uuid
import torch
import soundfile as sf
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydub import AudioSegment

# --- PATCH PYTORCH 2.6 ---
old_torch_load = torch.load
def new_torch_load(*args, **kwargs):
    kwargs['weights_only'] = False
    return old_torch_load(*args, **kwargs)
torch.load = new_torch_load
# -------------------------

from TTS.api import TTS

app = FastAPI(title="DearVoices API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "/app/uploads"
OUTPUT_DIR = "/app/outputs"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"[DearVoices] Utilisation de : {device}")

# Chargement du modèle au démarrage (lourd, on le fait une seule fois)
print("[DearVoices] Chargement du modèle XTTS v2...")
tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)
print("[DearVoices] Modèle prêt !")

# Nom du fichier voix de référence actif
VOICE_FILENAME = "ma_voix.wav"


@app.get("/")
def root():
    return {"status": "ok", "message": "DearVoices API is running"}


@app.post("/upload-voice")
async def upload_voice(file: UploadFile = File(...)):
    """
    Reçoit un fichier audio (enregistrement du micro) et le stocke
    comme voix de référence pour le clonage.
    Convertit automatiquement en WAV 22kHz mono (format attendu par XTTS).
    """
    if not file.content_type.startswith("audio"):
        raise HTTPException(status_code=400, detail="Le fichier doit être un audio.")

    # Sauvegarde temporaire du fichier brut (webm, ogg, mp4…)
    tmp_path = os.path.join(UPLOAD_DIR, f"tmp_{uuid.uuid4().hex[:8]}")
    contents = await file.read()
    with open(tmp_path, "wb") as f:
        f.write(contents)

    # Conversion en WAV 22050 Hz mono via pydub + ffmpeg
    dest_path = os.path.join(UPLOAD_DIR, VOICE_FILENAME)
    try:
        audio = AudioSegment.from_file(tmp_path)
        audio = audio.set_channels(1).set_frame_rate(22050)
        audio.export(dest_path, format="wav")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur de conversion audio : {str(e)}")
    finally:
        os.remove(tmp_path)

    return JSONResponse({"message": "Voix enregistrée avec succès.", "filename": VOICE_FILENAME})


@app.post("/generate")
async def generate_voice(text: str = Form(...), language: str = Form("fr")):
    """
    Génère un fichier audio à partir du texte fourni,
    en utilisant la voix de référence uploadée.
    """
    voice_path = os.path.join(UPLOAD_DIR, VOICE_FILENAME)
    if not os.path.exists(voice_path):
        raise HTTPException(
            status_code=404,
            detail="Aucune voix de référence trouvée. Veuillez d'abord enregistrer votre voix."
        )

    if not text.strip():
        raise HTTPException(status_code=400, detail="Le texte ne peut pas être vide.")

    output_filename = f"output_{uuid.uuid4().hex[:8]}.wav"
    output_path = os.path.join(OUTPUT_DIR, output_filename)

    wav = tts.tts(
        text=text,
        speaker_wav=voice_path,
        language=language
    )

    sf.write(output_path, wav, 24000)  # XTTS génère du 24kHz

    return JSONResponse({
        "message": "Audio généré avec succès.",
        "filename": output_filename,
        "url": f"/audio/{output_filename}"
    })


@app.get("/audio/{filename}")
def get_audio(filename: str):
    """
    Retourne le fichier audio généré.
    """
    file_path = os.path.join(OUTPUT_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Fichier audio introuvable.")
    return FileResponse(file_path, media_type="audio/wav", filename=filename)


@app.get("/voice-status")
def voice_status():
    """
    Indique si une voix de référence a déjà été uploadée.
    """
    voice_path = os.path.join(UPLOAD_DIR, VOICE_FILENAME)
    return {"has_voice": os.path.exists(voice_path)}
