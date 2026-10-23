import { redirect } from 'next/navigation';

/** Transactions now live inside the wallet page. Keep old links working. */
export default function TransactionsPage() {
  redirect('/wallet?tab=transactions');
}
