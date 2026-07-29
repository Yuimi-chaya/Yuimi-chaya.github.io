export const KISARA_AUDIO_STORAGE_KEY = "yuimi-kisara-playlist-v2";
export const KISARA_AUDIO_LEGACY_STORAGE_KEY = "yuimi-kisara-audio-v1";
export const KISARA_SECRET_AUDIO_SESSION_KEY = "yuimi-kisara-secret-playlist-v1";
export const KISARA_AUDIO_VOLUME = 0.48;

export const kisaraAudioTracks = [
  { id: "taisaku-kanryo", title: "対策完了", src: "/themes/kisara/audio/taisaku-kanryo.mp3" },
  { id: "bayron-city", title: "ベイロンシティ", src: "/themes/kisara/audio/bayron-city.mp3" },
  { id: "ai-no-chikara", title: "愛の力", src: "/themes/kisara/audio/ai-no-chikara.mp3" },
  { id: "aikagi", title: "合鍵", src: "/themes/kisara/audio/aikagi.mp3" },
  { id: "kokoro-no-oku", title: "心の奥", src: "/themes/kisara/audio/kokoro-no-oku.mp3" },
  { id: "mitakunai-kako", title: "見たくない過去", src: "/themes/kisara/audio/mitakunai-kako.mp3" },
  { id: "chanto-tabeteru", title: "ちゃんと食べてる？", src: "/themes/kisara/audio/chanto-tabeteru.mp3" },
  { id: "ichaicha-mousou", title: "イチャイチャ（妄想）", src: "/themes/kisara/audio/ichaicha-mousou.mp3" },
  { id: "kanashii-kako", title: "悲しい過去", src: "/themes/kisara/audio/kanashii-kako.mp3" },
  { id: "honki-mode", title: "本気モード", src: "/themes/kisara/audio/honki-mode.mp3" },
  { id: "kioku-no-yukue", title: "記憶の行方", src: "/themes/kisara/audio/kioku-no-yukue.mp3" }
] as const;

export const kisaraSecretAudioTracks = [
  {
    id: "kokoro-spare-key",
    title: "ココロスペアキー",
    src: "/themes/kisara/audio/kokoro-spare-key.mp3",
    variant: "demon",
    persistAcrossReload: true
  },
  {
    id: "kioku-kikan",
    title: "记忆归还",
    src: "/themes/kisara/audio/kioku-kikan.mp3",
    variant: "memory",
    persistAcrossReload: false
  }
] as const;

export const kisaraSecretAudioTrack = kisaraSecretAudioTracks[0];
