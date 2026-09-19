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
npm test           # vitest
npm run build      # tsc + vite + prerender (647 statik sayfa)
npm run deploy     # Cloudflare Pages
```

`npm run build` her bolum icin `dist/program/<id>/index.html` uretir; govdede
zincir duz metin olarak bulunur, boylece arama motoru JavaScript calistirmadan
da gorur.
