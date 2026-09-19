# DEU On Kosul

Dokuz Eylul Universitesi on kosullu dersler: hangi dersten kalinca hangi
dersleri alamazsin, zincir kac yariyil ileri gider.

Giris yok, transkript yok, kullanici verisi yok. Tek bir soruyu cevaplar.

## Neden ayri bir uygulama

`dokuzeylul-analyzer` transkript okur, not tutar, GANO hesaplar. Bu uygulama
hicbirini yapmaz; katalogun on kosul bilgisini herkese acik sekilde gosterir.
Ayri tutulmasinin bedeli veri uretim adiminin paylasilmasi, karsiligi ise
228 KB'lik bir paket ve 688 KB'lik bir veri seti (analyzer'da 14 MB).

## Gorunum

NodeBB Harmony (forum) ile ayni: Bootstrap 5, Inter, `--bs-primary #0d6efd`,
`--bs-border-radius 0.375rem`. Ek tema katmani yok.

## Akis

Adim adim sihirbaz, ekranda ayni anda tek soru:

```
/program/:id                       1) Bolum onayi
/program/:id/yil                   2) Giris yili   (arsiv yoksa atlanir)
/program/:id/yil/:year/ders        3) Hangi dersten kaldin
/program/:id/yil/:year/ders/:code  4) Sonuc
```

Siralama tablosu ve zincir haritasi sonuc ekraninda "Detayi goster"
altinda durur.

## Veri

Kazima tek yerde: `dokuzeylul-analyzer/tools/scraper/scrape.py`. Bu depo onun
ciktisindan ince bir set uretir:

```
npm run data                            # ../dokuzeylulanalyzer/public/data
DEU_CATALOG_DIR=/baska/yol npm run data
```

Uretilen `public/data` commit edilir; uygulama calisma aninda analyzer'a
bagimli degildir.

Kaynak: DEU Ders Katalogu / Bilgi Paketi, "Dersin Onkosulu/Onkosullari" alani.
Yalnizca 2025-2026 katalogu cekilir (robots.txt eski yillari yasakliyor).

### Eski plan surumleri

Planlar degisiyor. Insaat 2024'te derslerini yeniden numaralandirdi:
AKISKANLAR MEKANIGI INS 2014 iken INS 2114 oldu, YAPI DINAMIGI INS 4009
iken INS 4109. 2021 girisli bir ogrencinin transkriptinde eski kodlar yazar
ve o plan daha siki: ayni dersten kalmak 3 degil 15 dersi kilitliyordu.

```
npm run archive    # eng.deu.edu.tr plan PDF arsivi -> public/data/plans
```

Kaynak eng.deu.edu.tr; robots.txt'i yalnizca /wp-includes/ kapatiyor.
debis'in yasakli katalog yillarina dokunulmaz.

Kapsam yalnizca **Muhendislik Fakultesi** (12 program, 49 surum). Diger
fakulteler ya arsiv yayinlamiyor (Isletme, IIBF) ya da robots.txt ile
kapatmis (Guzel Sanatlar: /wp-content/, /archives/). Arsivi olmayan
bolumlerde yil adimi atlanir ve sayfa bunu acikca soyler.

2024 ve sonrasi katalogdan gelir: katalog coklu onkosulu tasiyabiliyor,
PDF'in dar "On Sart" sutunu tasiyamiyor. `npm run archive` ayni doneme ait
bir PDF katalogda olmayan bir onkosul iddia ederse hata koduyla durur.

## Kurallar

On kosul kurali: Ogretim ve Sinav Uygulama Esaslari MADDE 6/5 -- "Bir derse on
sart olan ders veya dersler basarilmis olmadikca o ders alinamaz."

Katalogda on kosulun bos olmasi, fakultenin kendi esaslarinda bir sart
olmadigi anlamina gelmez. Sekiz fakulte (Tip ve Hukuk dahil) hic on kosul
tanimlamamis; o sayfalar bunu acikca soyler, "on kosul yok" demez.

Bazi on kosullar ders degil serbest metindir (orn. "HAZIRLIK SINIFI").
Zincire giremezler, ayri bir not olarak gosterilirler.

## Komutlar

```
npm run dev        # 5174
npm run archive    # eski plan surumlerini yeniden cek
npm test           # vitest
npm run build      # tsc + vite + prerender (647 statik sayfa)
npm run deploy     # Cloudflare Pages
```

`npm run build` su statik sayfalari uretir:

- `dist/program/<id>/index.html` -- bolumun zinciri, duz metin
- `dist/program/<id>/yil/guncel/ders/<slug>/index.html` -- "X dersinden
  kalirsan ne olur" sonuc sayfasi, her onkosullu ders icin bir tane (803 adet)
- sihirbazin ara adimlari `noindex` ile isaretlenir; icerik tasimiyorlar
