# Koersplein

Koersplein brengt aandelenbeurzen één voor één in beeld. De eerste beurs is Euronext Amsterdam.

## Eerste bouwfase

- alle actuele bedrijfsaandelen op Euronext Amsterdam;
- ieder verhandelbaar aandeel en iedere aandelenklasse afzonderlijk;
- per aandeel later de dagelijkse openings- en slotkoers vanaf de eerste handelsdag.

Koersplein is een nieuw, zelfstandig project. Er bestaat geen technische koppeling met Atlas en er wordt niets uit Atlas overgenomen zonder een afzonderlijke opdracht van Maarten.

## Lokaal bekijken

```bash
npm run dev
```

Open daarna `http://localhost:4173`.

## Amsterdamse bedrijvenlijst vernieuwen

```bash
npm run update:amsterdam
```

De bron is de officiële aandelenlijst van Euronext Amsterdam.
