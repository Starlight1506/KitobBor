# 📚 KitobBor — Aqlli Kutubxona Tizimi

**KitobBor** — bu kutubxona fondini avtomatlashtirish, Telegram WebApp orqali masofadan kitob bron qilish va QR-kod orqali kitob berish/qabul qilish jarayonlarini soniyalargacha qisqartirish uchun mo'ljallangan zamonaviy tizim.

---

## 🚀 Loyiha Maqsadi
Kutubxonachilarni qog'oz daftarlardan xalos etish va talabalarga kitob qidirish hamda 2 soatlik masofaviy bron qilish imkoniyatini taqdim etish orqali kutubxona jarayonlarini to'liq raqamlashtirish.

## 🛠 Texnologik Stek
Loyiha eng zamonaviy va tezkor texnologiyalar asosida qurilgan:
* **Backend:** FastAPI (Python 3.11+), Aiogram 3 (Telegram Bot)
* **Frontend:** Vue 3, Tailwind CSS (Telegram WebApp uchun moslashtirilgan)
* **Ma'lumotlar Bazasi:** PostgreSQL 16 (pg_trgm bilan fuzzy search uchun)
* **Kesh va Navbat:** Redis (Distributed Lock va 2 soatlik TTL uchun)
* **Infratuzilma:** Docker, Docker Compose

## ✨ Asosiy Imkoniyatlari
- **Parolsiz Kirish:** Telegram WebApp (initData) orqali xavfsiz va tezkor avtorizatsiya.
- **Aqlli Qidiruv (Fuzzy Search):** Kitob nomini imlo xatolari bilan yozganda ham to'g'ri topish imkoniyati.
- **Interaktiv Xarita:** Kitobning qaysi zal, javon va tokchada joylashganini aniq ko'rsatish.
- **Masofaviy Bron:** Mavjud kitobni kutubxonaga borguncha 2 soatga band qilib qo'yish.
- **Poyga Holatisiz (Zero Race Condition):** Redis yordamida bir vaqtda bir kitobga qilingan so'rovlarni xavfsiz taqsimlash.
- **QR-Skaner:** Kutubxonachi kamerasi yordamida kitobni 3 soniya ichida topshirish va qabul qilish.

## ⚙️ O'rnatish va Ishga Tushirish

Loyihani o'z serveringizda yoki lokal kompyuteringizda (masalan, Kali Linux) ishga tushirish uchun quyidagi qadamlarni bajaring:

### 1. Repozitoriyni yuklab olish
```bash
git clone [https://github.com/username/kitobbor.git](https://github.com/username/kitobbor.git)
cd kitobbor
