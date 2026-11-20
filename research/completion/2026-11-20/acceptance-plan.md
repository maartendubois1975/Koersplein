# Vijf beurzen samen op Render-test

Accepteer de bestaande 80/105/664 bedrijven en de onderzochte 16 Dublin/34 Lissabon. Dezelfde centrale collector, archiver, registercontracten en chartvalidator behandelen 899 bedrijven. De bestaande centrale workflow krijgt vijf marktjobs. Eenjaarsproefreeksen blijven gemarkeerd als onvolledige backfill en komen daardoor niet in gevalideerde voorspellingen.

Bescherm alle eerder opgeslagen dagrecords. Bewaar nieuwe historische bronverwijzingen en bronconflicten. Laat bedrijven zonder bronbewijs en de Toosla-opvolging zichtbaar in de bestaande quarantaine.

Valideer npm test, history:test, codeaudit, alle onderzoekstests, contracten, idempotente archivering, ongewijzigde oude records en de publicatiehelper met een lokale historie zonder Worker-manifest. Controleer in echte GitHub-jobs alle vijf marktcollecties en de archivering. Controleer de exacte Render-commit en de vijf live JSON-bestanden, catalogusaantallen en steekproefhistories.

Rollback is de vorige live testcommit c4deb845855817beaadbbba92a4029766a86aa42 opnieuw publiceren of uitsluitend deze geïntegreerde codecommit terugdraaien. Archiveer latere opgeslagen koersdata ook bij een rollback. Main, de productie-Worker en de productieservice vallen buiten de testpublicatie.
