import { QRCodeSVG } from 'qrcode.react';

export function TicketQRCard({ ticket }) {
  const qrPayload = JSON.stringify({
    ticketId: ticket._id,
    ticketCode: ticket.ticketCode,
    userId: ticket.userId?._id || ticket.userId,
    eventId: ticket.eventId?._id || ticket.eventId
  });

  return (
    <section className="rounded-3xl border border-indigo-100 bg-indigo-50 p-6 text-center">
      <h2 className="mb-2 text-lg font-black text-indigo-700">Mã vé Eventverse</h2>
      <p className="mb-5 text-sm text-slate-500">Xuất trình mã QR này khi tham gia sự kiện.</p>
      <div className="keep-light-surface mx-auto w-fit rounded-2xl bg-white p-4 shadow-sm">
        <QRCodeSVG value={qrPayload} size={220} level="H" includeMargin />
      </div>
      <p className="mt-5 font-mono text-lg font-black tracking-wider text-slate-900">{ticket.ticketCode}</p>
      {ticket.eventName && <p className="mt-1 text-sm font-semibold text-slate-600">{ticket.eventName}</p>}
    </section>
  );
}
