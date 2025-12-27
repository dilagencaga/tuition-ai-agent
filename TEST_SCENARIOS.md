# Test Senaryoları

## Hazırlık
1. Midterm API çalışıyor olmalı: `https://localhost:7125`
2. Node.js sunucusu çalışıyor olmalı: `npm start`
3. Tarayıcıda aç: `http://localhost:3001`

## Test 1: Harç Sorgulama
**Input**: `123456 harç bilgimi göster`
**Beklenen**:
- ✅ Öğrenci harç kartı görünmeli
- ✅ Student Number, Term, Amount Due bilgileri olmalı
- ✅ Mesaj Firestore'a kaydedilmeli

## Test 2: İki Adımda Harç Sorgulama
**Input 1**: `harç sorgula`
**Beklenen**: Bot öğrenci numarası soracak

**Input 2**: `123456`
**Beklenen**: Harç bilgileri kartı görünmeli

## Test 3: Ödenmemiş Harçlar
**Input**: `ödenmemiş harçları göster`
**Beklenen**:
- ✅ Unpaid Tuitions kartı
- ✅ Her öğrenci için ayrı kart
- ✅ Her kartta "Pay Now" butonu

## Test 4: Harç Ödeme
**Input**: `123456 harç öde`
**Beklenen**:
- ✅ Pay Tuition kartı
- ✅ Student Number, Term, Amount bilgileri
- ✅ "Pay Now" butonu (balance > 0 ise)

**Butona tıkla**:
- ✅ "Payment successful" mesajı
- ✅ Yeşil success badge

## Test 5: Gerçek Zamanlı Senkronizasyon
**Adımlar**:
1. İki tarayıcı penceresi aç (ikisi de localhost:3001)
2. Pencere 1'den mesaj gönder
3. Pencere 2'de mesajın anında görünmesini izle

**Beklenen**: Her iki pencerede de aynı mesajlar gerçek zamanlı görünmeli

## Test 6: Chat Temizleme
**Adımlar**:
1. Birkaç mesaj gönder
2. Sağ üstteki "🗑️ Temizle / Clear Chat" butonuna tıkla
3. Sayfa yenilenecek

**Beklenen**:
- ✅ Chat temizlenmeli
- ✅ Yeni session ID oluşmalı
- ✅ Eski mesajlar görünmemeli

## Test 7: Kalıcı Oturum
**Adımlar**:
1. Birkaç mesaj gönder
2. Sayfayı yenile (F5)

**Beklenen**:
- ✅ Tüm mesaj geçmişi yüklenmeli
- ✅ Aynı session ID kullanılmalı

## Test 8: Hata Durumları

### 8a: API Kapalı
**Adımlar**:
1. Midterm API'yi kapat (Ctrl+C)
2. `123456 harç sorgula` yaz

**Beklenen**:
- ✅ Gerçek hata mesajı: "API hatası: fetch failed..."
- ❌ Mock data GÖRÜNMEMELİ

### 8b: Olmayan Öğrenci
**Input**: `999999 harç bilgimi göster`
**Beklenen**: "Öğrenci bulunamadı (Student No: 999999)"

## Test 9: Firebase Kontrolü
**Adımlar**:
1. Firebase Console aç: https://console.firebase.google.com/project/se4458-tuition-chat/firestore
2. `messages` koleksiyonunu aç
3. Mesaj gönder

**Beklenen**:
- ✅ Her mesaj için 2 doküman (user + bot)
- ✅ `sessionId`, `role`, `message`, `metadata`, `createdAt` alanları dolu
- ✅ Gerçek zamanlı ekleniyor

## Test 10: Console Logları
**Tarayıcı Console'da (F12)**:
```
Session ID: sess_xxxxx_xxxxx
Message sent to Firestore: {...}
```

## Başarı Kriterleri
- [ ] Tüm 3 API endpoint çalışıyor (Query, Unpaid, Pay)
- [ ] Firestore'a mesajlar kaydediliyor
- [ ] Gerçek zamanlı senkronizasyon çalışıyor
- [ ] Chat temizleme çalışıyor
- [ ] Session kalıcılığı çalışıyor
- [ ] Mock data YOK (tüm veriler Midterm API'den geliyor)
- [ ] Hata durumları düzgün işleniyor
