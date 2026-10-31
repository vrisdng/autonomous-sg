import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Card, Pill, Disclosure, SoftCross } from '../components/Ui';
import { BillDraft, loadBillDraft, saveBillDraft, starterBillDraft } from '../data/billDraft';
import { loadPlanDraft } from '../data/planDraft';
import { useOuting } from '../hooks/useOuting';
import { confirmRemoteBillTotal, loadRemoteBill, reopenRemoteBillConfirmation, saveRemoteBill, setRemoteBillClaim, setRemoteGuestPaymentSent, setRemoteHostPaymentStatus, startRemoteGuestBill } from '../data/remoteBills';
import { billClaimsOpen, splitAuthoritativeCents } from '../features/split/sharedBill';
import { isRemotePlansConfigured, subscribeToRemotePlan } from '../data/remotePlans';
import { BillAdjustment, billChargeBreakdown, calculateBill, connectBillToPeople, formatCents, itemNetCents, parseSignedCents, SplitItem } from '../features/split/calculateBill';
import { BillAdjustments } from '../components/BillAdjustments';
import { ConfirmTotalPaid } from '../components/ConfirmTotalPaid';
import { parseReceiptText, receiptItems } from '../features/split/parseReceipt';
import { effectivePaymentStatus } from '../features/split/settlements';
import { ReceiptScanner } from '../components/ReceiptScanner';
import { ParsedReceiptItem } from '../features/split/parseReceipt';
import { colors } from '../theme';
import { PlanDraft, Tab } from '../types';

export function SplitScreen({ go }: { go: (tab: Tab) => void }) {
  const outing=useOuting();
  const [draft, setDraft] = useState<BillDraft>(starterBillDraft);
  const [plan, setPlan] = useState<PlanDraft | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [shared, setShared] = useState(false);
  const [clearFor,setClearFor]=useState<string>();
  const [choosingPerson,setChoosingPerson]=useState(false);
  const [billSync, setBillSync] = useState<'local' | 'loading' | 'ready' | 'saving' | 'saved' | 'error'>('local');
  const [billSyncError, setBillSyncError] = useState('');
  const [remoteBillExists, setRemoteBillExists] = useState<boolean | null>(null);
  const [scannerPlan,setScannerPlan]=useState<string>();
  const [receiptText, setReceiptText] = useState('');
  const [settlementWorkingId, setSettlementWorkingId] = useState<string>();
  const dirty = useRef(false);
  const operation = useRef(false);
  const editVersion = useRef(0);
  const mounted = useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;operationVersion.current++;};},[]);
  const operationVersion = useRef(0);
  const [recovery, setRecovery] = useState<BillDraft>();

  useEffect(() => {
    let active = true;
    setLoadFailed(false);
    loadPlanDraft().then(async (activePlan) => {
      const savedBill = await loadBillDraft(activePlan?.code);
      if (!active) return;
      setPlan(activePlan);
      if(activePlan) {
        const backup=await loadBillDraft(`${activePlan.code}:recovery`);
        if(active && backup.pendingSync)setRecovery(backup);
      }
      if(!active)return;
      dirty.current = activePlan?.remote?.role === 'guest' ? false : Boolean(savedBill.pendingSync);
      let nextDraft = activePlan?.remote?.role === 'guest' ? { ...savedBill, pendingSync:false } : savedBill;
      if (activePlan?.participants.length) {
        nextDraft = { ...nextDraft, ...connectBillToPeople(nextDraft.items, nextDraft.people, activePlan.participants) };
        if (activePlan.remote?.published && isRemotePlansConfigured()) {
          setBillSync('loading');
          try {
            const remoteBill = await loadRemoteBill(activePlan.code);
            if (remoteBill && (!savedBill.pendingSync || activePlan.remote.role === 'guest')) { nextDraft = { ...nextDraft, ...remoteBill, pendingSync: false }; dirty.current=false; }
            else if (activePlan.remote.role === 'guest') { nextDraft = { ...nextDraft, items: [], pendingSync:false }; dirty.current=false; }
            setRemoteBillExists(Boolean(remoteBill));
            setBillSync('ready');
          } catch (error) {
            setBillSyncError(error instanceof Error ? error.message : 'Could not load the shared bill.');
            setBillSync('error');
          }
        }
        if (active) setPlan(activePlan);
      }
      if (!active) return;
      setDraft(nextDraft);
      setLoaded(true);
    }).catch(() => { if (active) { setBillSyncError('Could not load the saved bill. Your saved copy has not been replaced.'); setLoadFailed(true); } });
    return () => { active = false; };
  }, [loadAttempt]);
  useEffect(() => { if (loaded) saveBillDraft(draft, plan?.code).catch(() => setBillSyncError('Could not save this bill on your device. Keep this tab open and retry.')); }, [draft, loaded, plan?.code]);
  useEffect(()=>{
    if(!loaded || !outing.loaded || JSON.stringify(outing.plan)===JSON.stringify(plan))return;
    if(outing.plan?.code!==plan?.code){setLoaded(false);operationVersion.current++;setLoadAttempt((value)=>value+1);return;}
    setPlan(outing.plan);
    if(outing.plan && !operation.current && JSON.stringify(outing.plan.participants)!==JSON.stringify(plan?.participants)){
      const people=outing.plan.participants;
      setDraft((current)=>({...current,...connectBillToPeople(current.items,current.people,people)}));
    }
  },[outing.plan,outing.loaded,loaded]);

  useEffect(() => {
    if (!plan?.remote?.published || !isRemotePlansConfigured()) return;
    let active = true;
    const reload = async () => {
      if (dirty.current || operation.current) return;
      const version=operationVersion.current;
      try {
        const remoteBill = await loadRemoteBill(plan.code);
        if (!active || dirty.current || operation.current || version!==operationVersion.current) return;
        if (remoteBill) setDraft((current) => ({ ...current, ...remoteBill, pendingSync: false }));
        setRemoteBillExists(Boolean(remoteBill));
        setBillSync('ready');
        setBillSyncError('');
      } catch { if (active) setBillSyncError('Shared bill refresh paused. Local edits remain saved; retry when connected.'); }
    };
    const unsubscribe = subscribeToRemotePlan(plan.code, () => void reload(), () => undefined);
    const timer = setInterval(() => void reload(), 15000);
    return () => { active = false; unsubscribe(); clearInterval(timer); };
  }, [plan]);

  const adjustments = draft.adjustments ?? [];
  const chargedText = draft.finalTotal ?? '';
  const printedText = draft.receiptTotal ?? '';
  const typedCents = chargedText.trim() ? parseSignedCents(chargedText) : null;
  const printedCents = printedText.trim() ? parseSignedCents(printedText) : null;
  const explicitFinal = typedCents !== null && typedCents >= 0 ? typedCents : printedCents !== null && printedCents >= 0 ? printedCents : null;
  const itemCents = draft.items.reduce((sum, item) => sum + itemNetCents(item), 0);
  const requiresConfirmation = draft.requiresTotalConfirmation === true;
  const totalConfirmed = billClaimsOpen(draft);
  const authoritativeCents = splitAuthoritativeCents({
    requiresTotalConfirmation: draft.requiresTotalConfirmation,
    confirmedAt: draft.confirmedAt,
    confirmedTotal: draft.confirmedTotal,
    adjustments,
    explicitFinalCents: explicitFinal,
  });
  const breakdown = useMemo(() => billChargeBreakdown(draft.items, adjustments, Number(draft.servicePercent) || 0, Number(draft.gstPercent) || 0), [draft.items, draft.servicePercent, draft.gstPercent, adjustments]);
  const confirmAmount = chargedText.trim() ? chargedText : formatCents(Math.max(0, breakdown.computedCents));
  const confirmCents = parseSignedCents(confirmAmount);
  const gapCents = confirmCents === null ? null : confirmCents - breakdown.computedCents;
  const totals = useMemo(() => calculateBill(draft.items, draft.people, Number(draft.servicePercent) || 0, Number(draft.gstPercent) || 0, adjustments, authoritativeCents), [draft, adjustments, authoritativeCents]);
  const validBill = draft.people.length > 0 && draft.people.every((person) => person.name.trim())
    && draft.items.every((item) => item.name.trim() && /^\d{1,7}(\.\d{1,2})?$/.test(item.price.trim()) && (!item.itemDiscount || parseSignedCents(item.itemDiscount) !== null))
    && adjustments.every((row) => row.label.trim().length > 0 && parseSignedCents(row.amount) !== null && (!row.percent || (/^\d{1,3}(\.\d{1,3})?$/.test(row.percent) && Number(row.percent) <= 100)))
    && (!chargedText.trim() || (typedCents !== null && typedCents >= 0))
    && [draft.servicePercent, draft.gstPercent].every((rate) => /^\d{1,3}(\.\d{1,3})?$/.test(rate) && Number(rate) <= 100);
  const parsedReceipt = useMemo(() => parseReceiptText(receiptText), [receiptText]);
  const parsedReceiptTotal = useMemo(() => parsedReceipt.reduce((sum, item) => sum + Number(item.price), 0), [parsedReceipt]);
  const isRemoteGuest = plan?.remote?.published === true && plan.remote.role === 'guest';
  const guestParticipantId = isRemoteGuest ? plan.remote?.participantId : undefined;
  const planClosed = plan?.status === 'closed';
  const guestCanStart=Boolean(isRemoteGuest&&remoteBillExists===false);
  const billReadOnly = Boolean(planClosed || (isRemoteGuest&&!guestCanStart) || settlementWorkingId);
  const update = (changes: Partial<BillDraft>) => { editVersion.current++; dirty.current = true; setDraft((current) => ({ ...current, ...changes, pendingSync: true })); };
  const updatePerson = (id: string, name: string) => update({ people: draft.people.map((person) => person.id === id ? { ...person, name } : person) });
  const addPerson = () => update({ people: [...draft.people, { id: `p${Date.now()}`, name: '' }] });
  const removePerson = (id: string) => {
    if (draft.people.length <= 2) return;
    update({ people: draft.people.filter((person) => person.id !== id), items: draft.items.map((item) => ({ ...item, claimantIds: item.claimantIds.filter((claimant) => claimant !== id) })) });
  };
  const updateItem = (id: string, changes: Partial<SplitItem>) => update({ items: draft.items.map((item) => item.id === id ? { ...item, ...changes } : item) });
  const addItem = () => update({ items: [...draft.items, { id: `i${Date.now()}`, name: '', price: '', claimantIds: [] }] });
  const importReceipt = () => {
    if (!parsedReceipt.length) return;
    update({ items: [...draft.items, ...receiptItems(parsedReceipt)] });
    setReceiptText('');
  };
  const scannerAllowed=loaded&&!loadFailed&&!billReadOnly&&billSync!=='loading'&&!recovery;
  const scannerKey=plan?.code??'local';
  const importScan=(items:ParsedReceiptItem[],scannedAdjustments:BillAdjustment[],finalTotal:string,paymentLabel='')=>{if(!scannerAllowed||scannerPlan!==scannerKey)return false;update({items:[...draft.items,...receiptItems(items)],...(!draft.items.length?{adjustments:scannedAdjustments,finalTotal,receiptTotal:finalTotal,paymentLabel,confirmedTotal:'',confirmedAt:'',servicePercent:'0',gstPercent:'0'}:{})});setScannerPlan(undefined);return true;};
  useEffect(()=>{if(!scannerAllowed||scannerPlan!==scannerKey)setScannerPlan(undefined);},[scannerAllowed,scannerKey]);
  const removeItem = (id: string) => update({ items: draft.items.filter((item) => item.id !== id) });
  const toggleClaim = async (item: SplitItem, personId: string) => {
    if(!totalConfirmed||guestCanStart||(operation.current && isRemoteGuest) || planClosed || settlementWorkingId)return;
    const claimed = !item.claimantIds.includes(personId);
    if (isRemoteGuest) {
      if (!plan || personId !== guestParticipantId) return;
      if (operation.current) return;
      operation.current = true;
      operationVersion.current++;
      // Guest claims are confirmed by the server. Do not persist an optimistic
      // host-style dirty draft that would prevent polling after a failed request.
      setBillSync('saving');
      try {
        const remoteBill = await setRemoteBillClaim(plan, item.id, claimed);
        setDraft((current) => ({ ...current, ...remoteBill, pendingSync: false }));
        setBillSync('saved');
        setBillSyncError('');
        dirty.current = false;
      } catch (error) {
        setBillSyncError(error instanceof Error ? error.message : 'Could not save your claim.');
        setBillSync('error');
      } finally { operation.current = false; }
      return;
    }
    updateItem(item.id, { claimantIds: claimed ? [...item.claimantIds, personId] : item.claimantIds.filter((id) => id !== personId) });
  };
  const toggleEveryone = (item: SplitItem) => updateItem(item.id, { claimantIds: item.claimantIds.length === draft.people.length ? [] : draft.people.map((person) => person.id) });
  const reset = () => {
    if(billReadOnly||operation.current||clearFor!==scannerKey)return;
    setClearFor(undefined);
    editVersion.current++;
    dirty.current = true;
    setDraft({ ...starterBillDraft, currentPersonId:draft.currentPersonId, people: draft.people, revision: draft.revision, pendingSync: true });
    setShared(false);
  };

  const shareSummary = async () => {
    try {
    const lines = draft.people.map((person) => {
      const status = paymentState(person.id);
      return `${person.name || 'Unnamed'}: S$${formatCents(totals.perPersonCents[person.id] ?? 0)} · ${status === 'received' ? 'received' : status === 'sent' ? 'sent, awaiting host' : 'unpaid'}`;
    });
    const message = `Bojio? bill · Total S$${formatCents(totals.totalCents)}\n${lines.join('\n')}`;
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) await navigator.clipboard.writeText(message);
    else await Share.share({ title: 'Bojio? bill split', message });
    setShared(true); setTimeout(() => setShared(false), 1800);
    } catch { setBillSyncError('Could not copy or share the bill. Please retry; your bill is still saved.'); }
  };

  const syncSharedBill = async () => {
    if (!plan || operation.current || !validBill || planClosed || (isRemoteGuest&&!guestCanStart)) return;
    const editing=editVersion.current;
    const scope=operationVersion.current+1;
    operation.current = true;
    operationVersion.current++;
    setBillSync('saving');
    setBillSyncError('');
    try {
      const savedBill = guestCanStart?await startRemoteGuestBill(plan,draft):await saveRemoteBill(plan, draft);
      if(!mounted.current||scope!==operationVersion.current)return;
      const changed=editing!==editVersion.current;
      setDraft((current) => changed ? {...current,revision:savedBill.revision,pendingSync:true} : ({ ...current, ...savedBill, pendingSync: false }));
      setRemoteBillExists(true);
      setBillSync('saved');
      dirty.current = changed;
    } catch (error) {
      if(!mounted.current||scope!==operationVersion.current)return;
      if(guestCanStart&&error instanceof Error&&/bill already exists/i.test(error.message)){
        try {
          setRecovery(draft);await saveBillDraft(draft,`${plan.code}:recovery`);
          const latest=await loadRemoteBill(plan.code);
          if(latest){setDraft(current=>({...current,...latest,pendingSync:false}));setRemoteBillExists(true);dirty.current=false;setBillSync('ready');setBillSyncError('Someone else added the receipt first. Their shared bill is loaded; your version is kept in recovery.');return;}
        } catch { /* Fall through with the original actionable conflict. */ }
      }
      setBillSyncError(error instanceof Error ? error.message : 'Could not save. Your edits are kept on this device.');
      setBillSync('error');
    } finally { operation.current = false; }
  };

  useEffect(()=>{
    if(!loaded||!dirty.current||!plan?.remote?.published||(isRemoteGuest&&!guestCanStart)||planClosed||!validBill||recovery||billSync==='loading'||billSync==='saving'||billSync==='error')return;
    const timer=setTimeout(()=>void syncSharedBill(),600);
    return()=>clearTimeout(timer);
  },[draft,loaded,billSync,plan,validBill,recovery]);
  useEffect(()=>{if(Platform.OS!=='web')return;const online=()=>setBillSync(current=>current==='error'?'ready':current);window.addEventListener('online',online);return()=>window.removeEventListener('online',online);},[]);

  const refreshBill = async () => {
    if (!plan || operation.current) return;
    operation.current = true;
    setSettlementWorkingId('refresh');
    operationVersion.current++;
    setBillSync('saving');
    try {
      if (dirty.current) { setRecovery(draft); await saveBillDraft(draft, `${plan.code}:recovery`); }
      const latest = await loadRemoteBill(plan.code);
      setDraft((current) => ({ ...current, ...(latest ?? { ...starterBillDraft, people: current.people }), pendingSync: false }));
      dirty.current = false; setRemoteBillExists(Boolean(latest)); setBillSync('ready'); setBillSyncError('Latest bill loaded. Previous local edits are available below.');
    } catch (cause) { setBillSync('error'); setBillSyncError(cause instanceof Error ? cause.message : 'Refresh failed.'); }
    finally { operation.current = false; setSettlementWorkingId(undefined); }
  };

  const paymentState = (personId: string) => {
    const amountCents = totals.perPersonCents[personId] ?? 0;
    const saved = draft.settlements[personId];
    return effectivePaymentStatus(saved, amountCents);
  };

  const rateRows = (servicePercent: number, gstPercent: number) => {
    const net = draft.items.reduce((sum, item) => sum + itemNetCents(item), 0) + adjustments.filter((row) => row.kind === 'discount').reduce((sum, row) => sum + (parseSignedCents(row.amount) ?? 0), 0);
    const service = Math.round(net * Math.max(0, servicePercent) / 100);
    const gst = Math.round((net + service) * Math.max(0, gstPercent) / 100);
    const rows: BillAdjustment[] = [];
    if (servicePercent > 0) rows.push({ id: `rate-service-${Date.now()}`, label: 'Service charge', kind: 'service', amount: formatCents(service), percent: String(servicePercent) });
    if (gstPercent > 0) rows.push({ id: `rate-gst-${Date.now()}`, label: 'GST', kind: 'tax', amount: formatCents(gst), percent: String(gstPercent) });
    return rows;
  };
  const confirmPaid = async () => {
    if (totalConfirmed || !validBill || planClosed || operation.current || confirmCents === null || confirmCents < 0) return;
    const amount = formatCents(confirmCents);
    const materialized = adjustments.length ? null : rateRows(Number(draft.servicePercent) || 0, Number(draft.gstPercent) || 0);
    const nextAdjustments = materialized && materialized.length ? materialized : adjustments;
    const nextDraft = { ...draft, finalTotal: amount, adjustments: nextAdjustments, ...(nextAdjustments !== adjustments ? { servicePercent: '0', gstPercent: '0' } : {}) };
    if (!plan?.remote?.published || plan.remote.role !== 'host') {
      update({ ...nextDraft, confirmedTotal: amount, confirmedAt: new Date().toISOString() });
      return;
    }
    operation.current = true;
    operationVersion.current++;
    setBillSync('saving');
    setBillSyncError('');
    try {
      const needsSave = dirty.current || nextDraft.finalTotal !== draft.finalTotal || nextDraft.adjustments !== draft.adjustments;
      const saved = needsSave ? await saveRemoteBill(plan, nextDraft) : null;
      if (!mounted.current) return;
      if (saved) {
        setDraft((current) => ({ ...current, ...saved, paymentLabel: current.paymentLabel, pendingSync: false }));
        dirty.current = false;
      }
      const confirmed = await confirmRemoteBillTotal(plan, confirmCents, saved?.revision ?? draft.revision ?? 0);
      if (!mounted.current) return;
      setDraft((current) => ({ ...current, ...confirmed, paymentLabel: current.paymentLabel, pendingSync: false }));
      dirty.current = false;
      setBillSync('saved');
    } catch (error) {
      if (!mounted.current) return;
      setBillSyncError(error instanceof Error ? error.message : 'Could not confirm the total.');
      setBillSync('error');
    } finally { operation.current = false; }
  };
  const reopenPaid = async () => {
    if (!totalConfirmed || planClosed || operation.current) return;
    if (!plan?.remote?.published || plan.remote.role !== 'host') {
      update({ confirmedTotal: '', confirmedAt: '', totalRevisedAt: new Date().toISOString() });
      return;
    }
    operation.current = true;
    operationVersion.current++;
    setBillSync('saving');
    setBillSyncError('');
    try {
      const reopened = await reopenRemoteBillConfirmation(plan, draft.revision ?? 0);
      if (!mounted.current) return;
      setDraft((current) => ({ ...current, ...reopened, paymentLabel: current.paymentLabel, pendingSync: false }));
      dirty.current = false;
      setBillSync('saved');
    } catch (error) {
      if (!mounted.current) return;
      setBillSyncError(error instanceof Error ? error.message : 'Could not reopen the total.');
      setBillSync('error');
    } finally { operation.current = false; }
  };
  const addRounding = () => {
    if (!gapCents || billReadOnly) return;
    update({ adjustments: [...adjustments, { id: `round-${Date.now()}`, label: 'Rounding', kind: 'rounding', amount: `${gapCents < 0 ? '-' : ''}${formatCents(Math.abs(gapCents))}` }] });
  };

  const changePayment = async (personId: string, status: 'unpaid' | 'sent' | 'received') => {
    if (!validBill || !totalConfirmed || planClosed || totals.outstandingCents>0) return;
    if (operation.current) return;
    if (dirty.current && plan?.remote?.published) { setBillSyncError('Your items are still saving. Please try Paid again in a moment.'); return; }
    operation.current = true;
    operationVersion.current++;
    const amountCents = totals.perPersonCents[personId] ?? 0;
    setSettlementWorkingId(personId);
    setBillSyncError('');
    try {
      if (plan?.remote?.published && plan.remote.role === 'guest') {
        if (personId !== guestParticipantId) return;
        const saved = await setRemoteGuestPaymentSent(plan, amountCents, status === 'sent');
        setDraft((current) => ({ ...current, ...saved }));
      } else if (plan?.remote?.published && plan.remote.role === 'host') {
        const saved = await setRemoteHostPaymentStatus(plan, personId, amountCents, status);
        setDraft((current) => ({ ...current, ...saved }));
      } else {
        update({ settlements: { ...draft.settlements, [personId]: { status, amountCents, updatedAt: new Date().toISOString() } } });
      }
    } catch (error) {
      setBillSyncError(error instanceof Error ? error.message : 'Could not update payment status.');
    } finally {
      operation.current = false;
      setSettlementWorkingId(undefined);
    }
  };

  const myId=isRemoteGuest?guestParticipantId:(draft.people.some(p=>p.id===draft.currentPersonId)?draft.currentPersonId:draft.people.length===1?draft.people[0]?.id:undefined);
  const me=draft.people.find(p=>p.id===myId);
  const myAmount=myId?totals.perPersonCents[myId]??0:0;
  const myStatus=myId?paymentState(myId):'unpaid';
  const paymentBusy=Boolean(settlementWorkingId)||billSync==='saving'||Boolean(plan?.remote?.published&&dirty.current);
  const paymentReady=validBill&&totalConfirmed&&!planClosed&&!totals.outstandingCents&&!paymentBusy;

  // Do not expose editable controls until the saved/shared bill has loaded:
  // otherwise a slow initial response can overwrite an item just entered.
  if (!loaded) return <View style={styles.wrap}><Text accessibilityRole="alert" style={styles.copy}>{loadFailed ? billSyncError : 'Loading your bill…'}</Text>{loadFailed ? <Button label="Retry loading bill" onPress={()=>setLoadAttempt((value)=>value+1)} /> : null}</View>;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Split without paiseh</Text>
      <Text style={styles.copy}>Scan → pick what you ate → mark paid.</Text>

      <Text style={styles.syncStatus}>{planClosed?'This outing is closed — view only.':isRemoteGuest?(remoteBillExists?'Tap your name under the dishes you ate.':billSync==='saving'?'Starting the shared bill…':'No receipt yet—scan or paste one to start it for everyone.'):plan?.remote?.published?(billSync==='saving'?'Saving…':draft.pendingSync?'Changes waiting to save':'Saved for everyone'):'Saved on this device'}</Text>
      {billSync === 'loading' ? <Text style={styles.syncStatus}>Loading shared bill…</Text> : null}
      {billSyncError ? <Text style={styles.syncError}>{billSyncError}</Text> : null}
      {!validBill && draft.items.length>0 ? <Text style={styles.syncError}>Add named people and complete every item’s name, price, and discount. Enter tax and service rates between 0 and 100.</Text> : null}
      {billSyncError && plan?.remote?.published ? <View style={{gap:8}}><Button label="Try saving again" onPress={billSync!=='saving'?()=>void (dirty.current&&(!isRemoteGuest||guestCanStart)?syncSharedBill():refreshBill()):undefined}/><Disclosure title="Resolve conflicting edits"><Button secondary label="Load shared version · keep my backup" onPress={()=>void refreshBill()}/></Disclosure></View> : null}
      {recovery ? <Button label="Restore local bill edits" secondary onPress={() => { editVersion.current++; dirty.current = true; setDraft({...recovery,revision:draft.revision,pendingSync:true}); setRecovery(undefined); }} /> : null}

      {isRemoteGuest && requiresConfirmation && draft.items.length>0 && !totalConfirmed ? <View style={styles.warning}><Text accessibilityRole="alert" style={styles.warningText}>Waiting for host to confirm the total</Text>{draft.totalRevisedAt ? <Text style={styles.paymentCopy}>The host updated the total. Your share may have changed.</Text> : null}</View> : null}
      {isRemoteGuest && requiresConfirmation && totalConfirmed && draft.totalRevisedAt ? <Text style={styles.paymentCopy}>The host updated the total. Your share may have changed.</Text> : null}
      {!isRemoteGuest && requiresConfirmation && draft.items.length>0 ? <ConfirmTotalPaid paymentLabel={draft.paymentLabel} amount={chargedText} displayAmount={confirmAmount} confirmed={Boolean(draft.confirmedAt)} breakdown={breakdown} gapCents={gapCents} busy={billSync==='saving'} onAmount={(finalTotal) => update({ finalTotal })} onConfirm={confirmCents !== null && confirmCents >= 0 && validBill ? () => void confirmPaid() : undefined} onReopen={() => void reopenPaid()} onAddRounding={gapCents && !billReadOnly ? addRounding : undefined} onRescan={Platform.OS==='web' && scannerAllowed ? () => setScannerPlan(scannerKey) : undefined} /> : null}
      {draft.people.length>0&&draft.items.length>0&&totalConfirmed ? <View style={styles.myCard}>
        {me&&!choosingPerson?<View style={styles.sectionHeading}><Text style={styles.label}>YOUR SHARE · {me.name}</Text>{!isRemoteGuest?<Pressable accessibilityRole="button" accessibilityLabel="Change my name" onPress={()=>setChoosingPerson(true)} style={{padding:10}}><Text style={styles.addText}>Change</Text></Pressable>:null}</View>:<><Text style={styles.paymentTitle}>Which one is you?</Text><View style={styles.claims}>{draft.people.map(p=><Button key={p.id} secondary label={p.name||'Unnamed'} onPress={()=>{setDraft(current=>({...current,currentPersonId:p.id}));setChoosingPerson(false);}}/>)}</View></>}
        {me&&!choosingPerson?<><Text style={styles.copy}>{totals.outstandingCents?'Your share so far':'You pay'}</Text><Text accessibilityLabel="Your payment amount" style={styles.myAmount}>S$ {formatCents(myAmount)}</Text>
        <Text style={styles.paymentCopy}>{!draft.items.length?'Scan the receipt to get started.':totals.outstandingCents?'Pick your dishes below. The amount is final once all items are claimed.':myAmount===0?'No payment needed for your current share.':myStatus==='received'?'Paid ✓ · confirmed':myStatus==='sent'?'Paid ✓ · awaiting host confirmation':'Includes your share of service charge and GST.'}</Text>
        {myAmount>0?<Button label={settlementWorkingId===myId?'Saving payment…':myStatus==='received'?'Paid ✓':myStatus==='sent'?'Undo paid':'I’ve paid'} onPress={paymentReady&&myStatus!=='received'?()=>void changePayment(myId!,myStatus==='sent'?'unpaid':isRemoteGuest?'sent':'received'):undefined}/>:null}
        {paymentBusy?<Text style={styles.paymentCopy}>Saving your changes…</Text>:planClosed?<Text style={styles.paymentCopy}>This outing is closed.</Text>:null}</>:null}
      </View>:null}

      {!draft.items.length?<View style={{paddingVertical:26,alignItems:'center',gap:12}}><View style={{width:70,height:70,borderRadius:24,backgroundColor:colors.lime,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:32}}>🧾</Text></View><Text style={{fontSize:23,fontWeight:'800',color:colors.ink}}>Who ate the extra one?</Text><Text style={{fontSize:14,lineHeight:21,color:colors.muted,textAlign:'center'}}>Scan the receipt, pick your dishes,{`\n`}and we’ll do the maths.</Text></View>:null}
      {Platform.OS==='web'&&scannerAllowed?<Button label="Scan receipt 📷" onPress={()=>setScannerPlan(scannerKey)}/>:null}
      {!isRemoteGuest&&!planClosed&&draft.items.length>0?<View style={{gap:10}}><Pressable accessibilityRole="button" accessibilityLabel="Clear receipt" onPress={()=>setClearFor(scannerKey)} style={styles.clearButton}><Text style={{color:colors.reject,fontWeight:'800',fontSize:16}}>↻ Clear receipt</Text></Pressable>
        {clearFor===scannerKey?<View style={styles.warning}><Text style={{fontWeight:'800'}}>Clear this receipt for everyone?</Text><Text style={styles.paymentCopy}>Removes all receipt items and claims. People stay. This cannot be undone.</Text><View style={{gap:8}}><Button label="Keep receipt" secondary onPress={()=>setClearFor(undefined)}/><Button label="Yes, clear receipt" onPress={!operation.current&&!billReadOnly?reset:undefined}/></View></View>:null}
      </View>:null}
      {Platform.OS==='web'&&scannerAllowed&&scannerPlan===scannerKey?<ReceiptScanner key={scannerKey} existing={draft.items.length>0} onClose={()=>setScannerPlan(undefined)} onImport={importScan}/>:null}
      {!billReadOnly ? <Disclosure title="Paste a receipt instead">
        <View>
          <Text style={styles.importCopy}>Paste text copied from a receipt scan. Lines ending in a price become unclaimed items; totals, GST, and service-charge lines are ignored.</Text>
          <TextInput accessibilityLabel="Receipt text" multiline value={receiptText} onChangeText={setReceiptText} placeholder={'Har gow  7.80\nMee sua  9.50\nFried rice  12.00'} placeholderTextColor={colors.muted} style={styles.receiptInput} />
          <View style={styles.importPreview}><Text style={styles.previewLabel}>{parsedReceipt.length ? `${parsedReceipt.length} ${parsedReceipt.length === 1 ? 'item' : 'items'} recognised` : receiptText.trim() ? 'No item-and-price lines recognised yet' : 'Paste to preview'}</Text><Text style={styles.previewTotal}>S${parsedReceiptTotal.toFixed(2)}</Text></View>
          <Button label={parsedReceipt.length ? `Add ${parsedReceipt.length} unclaimed ${parsedReceipt.length === 1 ? 'item' : 'items'}` : 'Nothing ready to add'} onPress={parsedReceipt.length ? importReceipt : undefined} secondary />
          <Text style={styles.importNote}>Existing bill items stay untouched. Review names and prices before sharing the bill.</Text>
        </View>
      </Disclosure> : null}



      <Card>
        <View style={styles.sectionHeading}><Text style={styles.label}>WHAT DID YOU EAT?</Text><Text style={styles.label}>S$</Text></View>
        {isRemoteGuest && !remoteBillExists ? <Text style={styles.emptyBill}>Nothing to claim yet. Add receipt items above; the first valid receipt becomes the shared bill.</Text> : null}
        {draft.items.map((item) => <View key={item.id} style={styles.itemBlock}>
          <View style={styles.itemRow}><TextInput multiline accessibilityLabel={`Item name: ${item.name}`} editable={!billReadOnly} value={item.name} onChangeText={(name) => updateItem(item.id, { name })} placeholder="Item name" placeholderTextColor={colors.muted} style={styles.itemName} /><TextInput accessibilityLabel={`Item price: ${item.name || 'item'}`} editable={!billReadOnly} value={item.price} onChangeText={(price) => updateItem(item.id, { price })} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.muted} style={styles.itemPrice} />{!billReadOnly ? <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${item.name}`} onPress={() => removeItem(item.id)} style={styles.remove}><SoftCross /></Pressable> : null}</View>
          {item.itemDiscount != null ? <TextInput accessibilityLabel={`Item discount: ${item.name || 'item'}`} editable={!billReadOnly} value={item.itemDiscount} onChangeText={(itemDiscount) => updateItem(item.id, { itemDiscount })} keyboardType="decimal-pad" placeholder="-0.00" placeholderTextColor={colors.muted} style={styles.itemDiscount} /> : null}
          <View style={styles.claims}>{!billReadOnly&&!guestCanStart&&totalConfirmed ? <Pressable onPress={() => toggleEveryone(item)} style={[styles.claim, item.claimantIds.length === draft.people.length && styles.claimActive]}><Text style={[styles.claimText, item.claimantIds.length === draft.people.length && styles.claimTextActive]}>Everyone</Text></Pressable> : null}{draft.people.map((person) => { const active = item.claimantIds.includes(person.id); const canToggle = totalConfirmed&&!guestCanStart&&!settlementWorkingId && !planClosed && (!isRemoteGuest || person.id === guestParticipantId); return <Pressable accessibilityLabel={`${active ? 'Unclaim' : 'Claim'} ${item.name} for ${person.name}`} accessibilityRole="button" disabled={!canToggle || (isRemoteGuest && billSync === 'saving')} key={person.id} onPress={() => void toggleClaim(item, person.id)} style={[styles.claim, active && styles.claimActive, !canToggle && styles.claimReadOnly]}><Text numberOfLines={1} style={[styles.claimText, active && styles.claimTextActive]}>{person.name || '?'}</Text></Pressable>; })}</View>
        </View>)}
        {draft.items.length || adjustments.length ? <BillAdjustments itemCents={itemCents} adjustments={adjustments} charged={chargedText} referenceCents={explicitFinal} readOnly={billReadOnly} showCharged={!draft.items.length} onChange={(rows) => update({ adjustments: rows })} onCharged={(finalTotal) => update({ finalTotal })} /> : null}
        {requiresConfirmation && !totalConfirmed && draft.items.length ? <Text style={styles.paymentCopy}>{isRemoteGuest ? 'Claiming stays off until the host confirms the total.' : 'Confirm the total before anyone claims a dish.'}</Text> : null}
        {!billReadOnly ? <Pressable onPress={addItem} style={styles.add}><Text style={styles.addText}>+ Add receipt item</Text></Pressable> : null}
        <Disclosure title="Service charge & GST" summary={adjustments.length || explicitFinal !== null ? 'Using the adjustment rows' : `${draft.servicePercent}% service · ${draft.gstPercent}% GST`}>{adjustments.length || explicitFinal !== null ? <Text style={styles.paymentCopy}>These rates are not added on top of the adjustment rows or the amount charged.</Text> : <View style={styles.rates}><Rate editable={!billReadOnly} label="Service %" value={draft.servicePercent} onChange={(servicePercent) => update({ servicePercent })} /><Rate editable={!billReadOnly} label="GST %" value={draft.gstPercent} onChange={(gstPercent) => update({ gstPercent })} /></View>}</Disclosure>

      </Card>

      {totalConfirmed && totals.unclaimedItemIds.length > 0 && <View style={styles.warning}><Text style={styles.warningText}>⚠ {totals.unclaimedItemIds.length} priced {totals.unclaimedItemIds.length === 1 ? 'item has' : 'items have'} nobody claiming · S${formatCents(totals.outstandingCents)} outstanding.</Text></View>}

      {draft.items.length>0&&totalConfirmed?<Card>
        <Text style={styles.paymentTitle}>Who has paid?</Text>
        <Text style={styles.paymentCopy}>Updates when someone taps “I’ve paid”. The host confirms receipt.</Text>
        {draft.people.map(person=>{const status=paymentState(person.id),amount=totals.perPersonCents[person.id]??0;return <View key={person.id} style={styles.paymentRow}>
          <View style={styles.paymentNameRow}><Text style={styles.paymentName}>{person.name}{person.id===myId?' (you)':''}</Text><Text style={styles.paymentAmount}>S$ {formatCents(amount)}</Text></View>
          <Text style={{color:status==='unpaid'?colors.muted:colors.mint,fontWeight:'700'}}>{amount===0?'Nothing owed':status==='received'?'Paid ✓ · confirmed':status==='sent'?'Paid ✓ · awaiting confirmation':'Not paid'}</Text>
          {!isRemoteGuest&&amount>0&&status!=='received'&&(person.id!==myId||status==='sent')?<Button secondary label={person.id===myId&&status==='unpaid'?'I’ve paid':plan?.remote?.published?'Confirm received':'Mark paid'} onPress={paymentReady?()=>void changePayment(person.id,person.id===myId&&status==='unpaid'?'sent':'received'):undefined}/>:null}
          {!isRemoteGuest&&status==='received'?<Button secondary label="Undo confirmation" onPress={paymentReady?()=>void changePayment(person.id,'unpaid'):undefined}/>:null}
        </View>})}
        {totals.outstandingCents?<Text style={styles.paymentCopy}>Finish claiming all items to enable payment buttons.</Text>:<Text style={styles.paymentNote}>Manual tracking only. Changing someone’s amount resets their payment status.</Text>}
      </Card>:null}

      {totalConfirmed ? <Card><Disclosure title="Bill breakdown & sharing">
        <View style={styles.totalRow}><Text style={styles.totalLabel}>Bill total</Text><Text style={styles.total}>S${formatCents(totals.totalCents)}</Text></View>
        <Text style={styles.breakdown}>{adjustments.length ? `Subtotal S$${formatCents(totals.subtotalCents)} · ${adjustments.map((row) => `${row.label || 'Adjustment'} ${row.amount.startsWith('-') ? '-' : ''}S$${formatCents(Math.abs(parseSignedCents(row.amount) ?? 0))}`).join(' · ')}` : `Subtotal S$${formatCents(totals.subtotalCents)} · service S$${formatCents(totals.serviceCents)} · GST S$${formatCents(totals.gstCents)}`}</Text>
        <View style={styles.divider} />
        {draft.people.map((person) => <View key={person.id} style={styles.owesRow}><Text style={styles.person}>{person.name || 'Unnamed'}</Text><Text style={styles.owes}>S${formatCents(totals.perPersonCents[person.id] ?? 0)}</Text></View>)}
        <Text style={styles.note}>{totals.outstandingCents ? 'Assign every priced item before collecting payment.' : 'Rounding is distributed by cents, so everyone’s amounts add up exactly to the bill total.'}</Text>
        <Button label={totals.outstandingCents ? 'Claim remaining items first' : shared ? (Platform.OS === 'web' ? 'Summary copied ✓' : 'Summary shared ✓') : 'Share settlement summary'} onPress={totals.outstandingCents || !validBill ? undefined : shareSummary} />
      </Disclosure></Card> : null}
      <Card>
        <Disclosure title={`People (${draft.people.length})`} summary={draft.people.map(person => person.name || 'Unnamed').join(' · ')} defaultOpen={!draft.people.length}>
        <View style={styles.sectionHeading}><Text style={styles.label}>PEOPLE</Text>{!plan?.participants.length ? <Pressable onPress={addPerson}><Text style={styles.addText}>+ Add person</Text></Pressable> : <Pressable accessibilityRole="button" onPress={()=>go('meet')}><Text style={styles.addText}>Edit group</Text></Pressable>}</View>
        {draft.people.map((person, index) => <View key={person.id} style={styles.personEditor}><Text style={styles.avatar}>{index + 1}</Text>{plan?.participants.length ? <Text style={styles.connectedPerson}>{person.name || 'Unnamed'}</Text> : <TextInput accessibilityLabel={`Person ${index + 1} name`} value={person.name} onChangeText={(name) => updatePerson(person.id, name)} placeholder="Name" placeholderTextColor={colors.muted} style={styles.personInput} />}{!plan?.participants.length && draft.people.length > 2 && <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${person.name || 'person'}`} onPress={() => removePerson(person.id)} style={styles.remove}><SoftCross /></Pressable>}</View>)}
        </Disclosure>
      </Card>
    </View>
  );
}

function Rate({ editable, label, value, onChange }: { editable: boolean; label: string; value: string; onChange: (value: string) => void }) { return <View style={styles.rate}><Text style={styles.rateLabel}>{label}</Text><TextInput editable={editable} value={value} onChangeText={onChange} keyboardType="decimal-pad" style={styles.rateInput} /></View>; }

const styles = StyleSheet.create({
  myCard: {padding:24,borderRadius:26,backgroundColor:colors.bambooSoft,gap:7}, myAmount:{fontSize:46,letterSpacing:-2,fontWeight:'900',color:colors.green}, clearButton:{minHeight:44,padding:8,alignSelf:'flex-end',alignItems:'center'},
  wrap: { gap: 14 }, title: { fontSize: 32, fontWeight: '900', color: colors.ink }, copy: { color: colors.muted, fontSize: 16, marginBottom: 3 }, label: { color: colors.green, fontWeight: '900', fontSize: 11, letterSpacing: 1.1 }, sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }, addText: { color: colors.ink, fontWeight: '900', fontSize: 12 },
  planBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: colors.ink, borderRadius: 18, padding: 15 }, flex: { flex: 1, minWidth:0 }, planLabel: { color: colors.lime, fontSize: 10, fontWeight: '900', letterSpacing: 0.9 }, planTitle: { color: colors.card, fontSize: 18, fontWeight: '900', marginTop: 3 }, planCopy: { color: colors.paper, fontSize: 12, lineHeight: 17, marginTop: 4 }, editGroup: { color: colors.lime, fontSize: 12, fontWeight: '900' }, syncStatus: { color: colors.green, textAlign: 'center', fontSize: 12, fontWeight: '800' }, syncError: { color: colors.reject, backgroundColor: colors.coralSoft, borderRadius: 12, padding: 10, fontSize: 12, fontWeight: '800' }, fromMeet: { color: colors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 0.7 }, personEditor: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 5 }, avatar: { backgroundColor: colors.lime, width: 27, height: 27, borderRadius: 14, textAlign: 'center', textAlignVertical: 'center', lineHeight: 27, color: colors.ink, fontWeight: '900' }, personInput: { flex: 1, borderBottomWidth: 1, borderBottomColor: colors.line, color: colors.ink, paddingVertical: 8, fontWeight: '700' }, connectedPerson: { flex: 1, color: colors.ink, paddingVertical: 8, fontWeight: '800' }, removeText: { color: colors.muted, fontSize: 20, fontWeight: '800' },
  importHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, importTitle: { color: colors.ink, fontSize: 19, fontWeight: '900', marginTop: 4 }, importToggle: { color: colors.ink, fontSize: 12, fontWeight: '900' }, importCopy: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 12 }, receiptInput: { minHeight: 116, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 14, color: colors.ink, padding: 12, marginTop: 10, textAlignVertical: 'top', fontFamily: Platform.OS === 'web' ? 'monospace' : undefined }, importPreview: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 10 }, previewLabel: { color: colors.green, fontSize: 12, fontWeight: '800' }, previewTotal: { color: colors.ink, fontSize: 18, fontWeight: '900' }, importNote: { color: colors.muted, fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 8 },
  emptyBill: { color: colors.muted, fontSize: 13, lineHeight: 19, paddingVertical: 14 }, itemBlock: { borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 10 }, itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, itemName: { flex: 1, minWidth: 0, width: 0, color: colors.ink, paddingVertical: 7, fontWeight: '700' }, itemPrice: { width: 76, minWidth: 0, flexShrink: 0, color: colors.ink, fontWeight: '900', textAlign: 'right', paddingVertical: 7 }, itemDiscount: { color: colors.muted, fontWeight: '700', fontSize: 13, paddingVertical: 4 }, remove: { width: 44, minHeight:44, justifyContent:'center', alignItems: 'center' }, claims: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }, claim: { maxWidth: 100, borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 12, minHeight:44, justifyContent:'center' }, claimActive: { backgroundColor: colors.blush, borderColor: colors.limeLine }, claimReadOnly: { opacity: 0.55 }, claimText: { color: colors.muted, fontWeight: '800', fontSize: 11 }, claimTextActive: { color: colors.ink }, add: { paddingVertical: 15, alignItems: 'center' }, syncButton: { marginTop: 14 },
  rates: { flexDirection: 'row', gap: 10 }, rate: { flex: 1, backgroundColor: colors.paper, borderRadius: 14, padding: 10 }, rateLabel: { color: colors.muted, fontSize: 10, fontWeight: '800' }, rateInput: { color: colors.ink, fontSize: 20, fontWeight: '900', paddingTop: 4 }, warning: { backgroundColor: colors.bambooSoft, borderRadius: 16, padding: 13 }, warningText: { color: colors.ink, fontWeight: '700', fontSize: 12 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }, totalLabel: { color: colors.ink, fontWeight: '800' }, total: { color: colors.ink, fontSize: 30, fontWeight: '900' }, breakdown: { color: colors.muted, fontSize: 12, marginTop: 4 }, divider: { height: 1, backgroundColor: colors.line, marginVertical: 14 }, owesRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7 }, person: { color: colors.ink, fontWeight: '700' }, owes: { color: colors.ink, fontWeight: '900' }, note: { color: colors.muted, fontSize: 11, lineHeight: 16, marginVertical: 12 }, reset: { alignItems: 'center', paddingTop: 14 }, resetText: { color: colors.muted, fontWeight: '700', fontSize: 12 },
  paymentTitle: { color: colors.ink, fontSize: 21, fontWeight: '900', marginTop: 5 }, paymentCopy: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 5, marginBottom: 8 }, paymentLocked: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.paper, borderRadius: 14, padding: 13 }, paymentLockedIcon: { fontSize: 18 }, paymentLockedText: { flex: 1, color: colors.muted, fontSize: 12, lineHeight: 17, fontWeight: '700' }, paymentRow: { borderTopWidth: 1, borderTopColor: colors.line, paddingVertical: 12, gap: 8 }, paymentNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, paymentName: { flex:1, minWidth:0, color: colors.ink, fontSize: 16, fontWeight: '900' }, paymentAmount: { color: colors.ink, fontSize: 18, fontWeight: '900', marginTop: 3 }, paymentAction: { padding:14, borderRadius:12, backgroundColor:colors.coralSoft, color: colors.green, fontSize: 12, fontWeight: '900', textAlign: 'right' }, paymentNote: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 4 },
});
