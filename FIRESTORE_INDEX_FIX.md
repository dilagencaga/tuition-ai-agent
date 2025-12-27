# Firestore Index Hatası Çözümü

## Hata Mesajı
```
Error: Real-time connection failed. The query requires an index.
```

## Çözüm 1: Otomatik Link (ÖNERİLEN)

Tarayıcı console'daki hata mesajındaki uzun linke tıkla. Link şuna benzer:
```
https://console.firebase.google.com/v1/r/project/se4458-tuition-chat/firestore/indexes?create_composite=...
```

Bu link seni direkt index oluşturma sayfasına götürür.

## Çözüm 2: Manuel Index Oluşturma

1. Firebase Console aç: https://console.firebase.google.com/project/se4458-tuition-chat/firestore/indexes

2. **"Indexes"** sekmesine git (Data sekmesinin yanında)

3. **"Create Index"** veya **"Add Index"** butonuna tıkla

4. Şu bilgileri gir:

   **Collection ID:** `messages`

   **Fields to index:**
   - Field path: `sessionId` → Order: **Ascending** ↗️
   - Field path: `createdAt` → Order: **Ascending** ↗️

   **Query scope:** Collection

5. **"Create"** butonuna tıkla

6. **2-5 dakika bekle** (Index oluşuyor...)

7. Status: **Building** → **Enabled** olduğunda hazır!

## Index Durumunu Kontrol Et

Firebase Console → Firestore → Indexes sekmesi

Şöyle görünmeli:
```
Collection: messages
Fields indexed: sessionId Asc, createdAt Asc
Status: ✅ Enabled
```

## Test Et

Index hazır olduğunda:

1. localhost:3001 sayfasını yenile (F5)
2. Bir mesaj gönder
3. Hata almamalısın!
4. Mesaj Firestore'da görünmeli!
