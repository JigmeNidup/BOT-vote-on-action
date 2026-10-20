export function VoteBar({ yes, no }: { yes: number; no: number }) {
  const total = yes + no;
  const yesWidth = total === 0 ? 0 : (yes / total) * 100;

  return (
    <div className="h-2 overflow-hidden rounded-full bg-line">
      <div className="flex h-full">
        <div className="bg-moss" style={{ width: `${yesWidth}%` }} />
        <div className="bg-ember" style={{ width: `${total === 0 ? 0 : 100 - yesWidth}%` }} />
      </div>
    </div>
  );
}
