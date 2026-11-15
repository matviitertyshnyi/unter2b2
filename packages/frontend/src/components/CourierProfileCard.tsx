import React, { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../api/client';
import { Courier, CourierMessage, HubInfo } from '../types/api';
import { formatVehicleClass, getHubLabel } from '../utils/format';
import { MessageIcon, PhoneIcon, PinIcon, SendIcon } from './Icons';
import styles from './CourierProfileCard.module.css';

interface CourierProfileCardProps {
  courier: Courier;
  hubs: HubInfo[];
  viewerRole?: 'business' | 'courier';
  viewerName?: string;
}

const BUSINESS_QUICK_MESSAGES = [
  'Where are you on the map right now?',
  'Can you pull up to the loading bay?',
  'Fragile cargo, please keep upright.',
];

const COURIER_QUICK_MESSAGES = [
  'On my way, 10 min out.',
  'Arriving at loading bay now.',
  'Unloaded current job and free for pickup.',
];

export const CourierProfileCard: React.FC<CourierProfileCardProps> = ({
  courier,
  hubs,
  viewerRole = 'business',
  viewerName = 'Olivia Dispatch Desk',
}) => {
  const [messages, setMessages] = useState<CourierMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const messagesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages.length]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getCourierMessages(courier.id)
      .then((res) => {
        if (!cancelled) {
          setMessages(res.messages);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Unable to load messages');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [courier.id]);

  const handleSend = async (textToSend?: string) => {
    const clean = (textToSend ?? draft).trim();
    if (!clean || sending) return;
    setError(null);
    setSending(true);
    try {
      const res = await api.sendCourierMessage(courier.id, {
        sender: viewerRole,
        senderName: viewerRole === 'courier' ? courier.name : viewerName,
        text: clean,
      });
      setMessages(res.messages);
      if (!textToSend) {
        setDraft('');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to send text');
    } finally {
      setSending(false);
    }
  };

  const quickChips =
    viewerRole === 'courier' ? COURIER_QUICK_MESSAGES : BUSINESS_QUICK_MESSAGES;
  const activeBusinessClient =
    [...messages].reverse().find((m) => m.sender === 'business')?.senderName ??
    'Olivia Star Roastery & Cafe';
  const isCourierViewer = viewerRole === 'courier';

  return (
    <section
      className={styles.card}
      aria-label={
        isCourierViewer
          ? `Business dispatch chat for ${courier.name}`
          : `Courier profile for ${courier.name}`
      }
    >
      {!isCourierViewer && (
        <>
          <div className={styles.topRow}>
            <div className={styles.identity}>
              <span className={styles.avatar}>{courier.avatarInitials}</span>
              <div>
                <h3 className={styles.name}>{courier.name}</h3>
                <div className={styles.meta}>
                  {courier.vehicleModel} ({formatVehicleClass(courier.vehicleClass)}) |{' '}
                  {courier.licensePlate}
                </div>
                <div className={styles.meta}>
                  Rating {courier.rating.toFixed(2)} | {courier.completedDeliveries} deliveries |{' '}
                  <span className="mono">{courier.phone}</span>
                </div>
              </div>
            </div>

            <span
              className={`${styles.statusBadge} ${
                courier.status === 'available' ? styles.statusAvailable : styles.statusBusy
              }`}
            >
              {courier.status === 'available' ? 'Available Now' : 'Busy on Run'}
            </span>
          </div>

          {/* Live Location & Status on Map */}
          <div
            className={`${styles.locationBox} ${courier.status === 'busy' ? styles.locationBusy : ''}`}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
              <PinIcon size={14} />
              {courier.status === 'busy'
                ? `Busy Live Position: ${courier.currentAddress}`
                : `Live Map Position: ${courier.currentAddress}`}
            </div>
            <div className={styles.meta}>
              Corridor: {getHubLabel(courier.currentHub, hubs)} to{' '}
              {getHubLabel(courier.destinationHub, hubs)} | Availability: {courier.availableFrom}
              {courier.activeOrderTitle ? ` | Active order: ${courier.activeOrderTitle}` : ''}
            </div>
          </div>

          <div className={styles.specsGrid}>
            <div className={styles.specWell}>
              <span className={styles.specLabel}>Trunk Bay</span>
              <span className={`${styles.specVal} mono`}>
                {courier.trunk.lengthCm}x{courier.trunk.widthCm}x{courier.trunk.heightCm} cm
              </span>
            </div>
            <div className={styles.specWell}>
              <span className={styles.specLabel}>Capacity</span>
              <span className={styles.specVal}>
                {courier.trunk.volumeLiters} L / {courier.trunk.maxWeightKg} kg
              </span>
            </div>
            <div className={styles.specWell}>
              <span className={styles.specLabel}>Rate / Contact</span>
              <span
                className={styles.specVal}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
              >
                <PhoneIcon size={12} />
                {courier.pricePerKmPln.toFixed(1)} zl/km
              </span>
            </div>
          </div>

          {courier.bio && <p className={styles.bio}>{courier.bio}</p>}
        </>
      )}

      {/* Direct Text Chat */}
      <div
        className={styles.chatSection}
        style={isCourierViewer ? { borderTop: 'none', paddingTop: 0 } : undefined}
      >
        <div className={styles.chatHeader}>
          <div>
            <h4 className={styles.chatTitle}>
              <MessageIcon size={15} />
              {isCourierViewer
                ? `Incoming Business Dispatch Chat (${messages.length})`
                : `Text ${courier.name} (${messages.length})`}
            </h4>
            {isCourierViewer && (
              <div className={styles.meta} style={{ marginTop: 2 }}>
                Client thread: {activeBusinessClient}
              </div>
            )}
          </div>
        </div>

        <div ref={messagesRef} className={styles.messagesList} aria-live="polite">
          {loading ? (
            <span className={styles.meta}>Loading conversation...</span>
          ) : messages.length === 0 ? (
            <span className={styles.meta}>No texts yet. Send a quick message below.</span>
          ) : (
            messages.map((msg) => {
              const isOwnMessage = msg.sender === viewerRole;
              const senderLabel = isOwnMessage
                ? isCourierViewer
                  ? `You (${courier.name} - Driver)`
                  : `${msg.senderName} (You - Business)`
                : isCourierViewer
                  ? `${msg.senderName} (Business Client)`
                  : `${msg.senderName} (Driver)`;

              return (
                <div
                  key={msg.id}
                  className={`${styles.msgBubble} ${
                    isOwnMessage ? styles.msgBusiness : styles.msgCourier
                  }`}
                >
                  <span className={styles.msgSender}>{senderLabel}</span>
                  <span>{msg.text}</span>
                </div>
              );
            })
          )}
        </div>

        {error && <div className={styles.errorMsg}>{error}</div>}

        <div className={styles.quickChips}>
          {quickChips.map((chip) => (
            <button
              key={chip}
              type="button"
              className={styles.quickChip}
              disabled={sending}
              onClick={() => void handleSend(chip)}
            >
              {chip}
            </button>
          ))}
        </div>

        <form
          className={styles.composeRow}
          onSubmit={(e) => {
            e.preventDefault();
            void handleSend();
          }}
        >
          <input
            type="text"
            className={styles.composeInput}
            placeholder={
              isCourierViewer
                ? 'Reply to business client...'
                : `Text ${courier.name}...`
            }
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label={
              isCourierViewer
                ? `Reply to ${activeBusinessClient}`
                : `Message to ${courier.name}`
            }
          />
          <button
            type="submit"
            className={styles.sendBtn}
            disabled={sending || !draft.trim()}
          >
            <SendIcon size={14} />
            {sending ? 'Sending...' : 'Send'}
          </button>
        </form>
      </div>
    </section>
  );
};
