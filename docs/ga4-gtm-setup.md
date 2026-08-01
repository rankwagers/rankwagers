# GA4 + Google Tag Manager (RankWagers)

Sitede **yalnızca GTM** yüklüdür (`GTM-5D4FPZ99`, `components/GoogleTagManager.tsx`).  
GA4 ölçüm kimliği: **`G-089KXEMR0R`**.

## Önemli: Manuel gtag.js eklemeyin

Google Analytics kurulum sihirbazındaki **“Manuel olarak yükleme”** snippet’ini (`gtag/js?id=G-089KXEMR0R`)  
**Next.js koduna yapıştırmayın.** Aynı sayfada GTM + gtag = **çift sayım**.

GA4’ü **Google Tag Manager** içinden bağlayın.

---

## GA4 arayüzünde

1. Veri akışı oluşturulduysa ölçüm kimliği `G-089KXEMR0R` kalsın.
2. Kurulum adımında mümkünse **“Google Etiket Yöneticisi ile yükleme”** / mevcut GTM container’ı seçin.
3. **Manuel gtag** adımını atlayın (kod zaten GTM ile geliyor).

---

## GTM’de (tagmanager.google.com → GTM-5D4FPZ99)

### 1. GA4 Yapılandırma

| Alan | Değer |
|------|--------|
| Etiket türü | Google Analytics: **GA4 Yapılandırması** |
| Ölçüm Kimliği | `G-089KXEMR0R` |
| Tetikleyici | **Initialization - All Pages** (yoksa **All Pages**) |

### 2. Affiliate tıklamaları (önerilen)

**Tetikleyici:** Tıklama – Yalnızca bağlantılar → `Click URL` **içerir** `/go/`

**Etiket:** GA4 Olayı → Yapılandırma: yukarıdaki tag → Olay adı: `affiliate_click`  
Parametreler (isteğe bağlı): `link_url` = `{{Click URL}}`, `link_text` = `{{Click Text}}`

### 3. Yayınla

Önizleme (Tag Assistant) → **Gönder** → **Yayınla**

Doğrulama: GA4 → **Raporlar → Gerçek zamanlı**; sitede gezinince kullanıcı görünmeli.

---

## Sunucu `.env` (referans)

GA4 kimliği build’e gömülmez; yalnızca GTM arayüzünde kullanılır. İsterseniz not için:

```bash
NEXT_PUBLIC_GTM_ID=GTM-5D4FPZ99
# GA4 — sadece GTM GA4 etiketinde; siteye gtag yapıştırmayın
# NEXT_PUBLIC_GA4_MEASUREMENT_ID=G-089KXEMR0R
```

`NEXT_PUBLIC_*` değiştirdiyseniz: `npm run build` + `pm2 restart aff-site --update-env`
