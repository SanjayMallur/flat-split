# Tally — how to build a screen in this look

1. Every top-level screen opens with `TallyTopBar`: a mono eyebrow and a serif title. Use
   `<Screen header={false}>`.
2. Every amount is a `Figure`, in the mono, so columns of money line up. Never set money in the serif
   or the text face.
3. The one number a screen exists for goes on a `BanknoteCard` or stands alone at hero size. One per
   screen.
4. Brass (the accent) is money coming in, the main action and the hero figure. Red is only over budget
   or money owed. Never green for profit: the whole page is green.
5. Lists are `LedgerRow`s under a mono day label: seal, name, dotted leader, amount. No cards round
   rows, no zebra stripes.
6. Budgets are `EnvelopeBar`s. Trends are one thin `TrendLine`. A split of a whole is one `SpendDonut`
   with a dotted key. Never bars in several colours.
7. No photos, no illustrations, no emoji. A merchant or account is a `Monogram`; the only face is the
   owner's `Avatar`.
8. A single transaction is a `ReceiptCard`: cream paper, mono lines, a torn edge. It is the only light
   surface in the look; do not use cream anywhere else.
9. Forms lead with the amount and an `AmountPad`; free text still uses the kit's single-line
   `TextField`; the save is a `TallyButton`, last.
10. Write like a careful bookkeeper: real merchants, dates, account endings, exact cents. Never
    "Transaction 1", never lorem.
11. Do not: gradients on buttons, pills, drop shadows, more than one hero, centred body text.
12. A screen's header never repeats a tab: no avatar or button that opens another tab from a top bar.
