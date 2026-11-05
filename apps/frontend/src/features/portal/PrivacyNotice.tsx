// NFR-C4 / §5.2: the full privacy notice behind the short consent sentence (D7). Data Protection Act, 2012 (Act 843).
import { Modal } from '@/components/ui';
import { organisation } from '@/lib/format';

export function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="page-title mb-4">Privacy notice</h1>
      <div className="panel p-5"><NoticeText /></div>
    </div>
  );
}

export function PrivacyNotice({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Privacy notice" wide>
      <NoticeText />
      <button className="btn-primary mt-5 w-full sm:w-auto" onClick={onClose}>Close</button>
    </Modal>
  );
}

function NoticeText() {
  return (
      <div className="space-y-3 text-sm leading-relaxed">
        <p><strong>Who we are.</strong> {organisation().name} runs this laundry system for its branch.</p>
        <p><strong>What we store.</strong> Your name, phone number, email (if you give one), pickup and delivery address, the location you choose to share, your laundry preferences, your orders, payments and receipts.</p>
        <p><strong>Why.</strong> Only to take, process, deliver and bill your orders, and to send you messages about them. We don't use your data for anything else and we don't sell it.</p>
        <p><strong>Location.</strong> We only read your location when you tap “Use my location”, and only to fill in your address. We don't track you.</p>
        <p><strong>Who sees it.</strong> Branch staff who need it for your order: the front desk, the laundry team (they see your items, not your contact details), riders delivering to you, and the branch manager. Every access to records is logged.</p>
        <p><strong>Your rights.</strong> You can view and correct your details at any time in Profile. You can ask the branch to see everything we hold about you. Reminder messages can be switched off in Profile; order receipts and security messages can't, because they are part of the service.</p>
        <p><strong>How long.</strong> Order and payment records are kept according to the branch's business-records policy. The legal basis is the Data Protection Act, 2012 (Act 843).</p>
      </div>
  );
}
