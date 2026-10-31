# Koersplein Amsterdam — schone testbasis

80 Amsterdamse koersreeksen, 85 catalogusregels waarvan vijf met een hoofdnotering elders. De website leest uitsluitend `data/history/*.json` en `data/amsterdam-history-manifest.json` voor Amsterdam. Geen oude Europa-jobs, Atlas, Cloudflare-scheduler of voorspelmachine in deze branch.

`npm test` controleert de 80 historische documenten en de publieke bestanden. Het is een structurele test, geen bevestiging van actuele koersen, beurslicenties of toekomstige rendementen. Publicatie van nieuwe prijzen blijft uit totdat een gecontroleerde dagelijkse import- en publicatieketen gereed is.

De oude ontwikkeltak `amsterdam-reset-20261027` blijft bewaard als herstelbron; productie is niet aangepast.
