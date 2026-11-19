import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import LegalDocument, { type LegalSection } from '../components/LegalDocument';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { deletionStatus, isConfirmationCode, type DeletionStatus } from '@/lib/server/privacy/metaDeletion';
import classes from './DataDeletion.module.css';

export const metadata: Metadata = {
  title: 'Data deletion | DeepVisor',
  description: 'How to delete the data DeepVisor keeps from Meta, or your whole account, and how to check a deletion request.',
  alternates: { canonical: '/data-deletion' },
};
export const dynamic = 'force-dynamic';

type Copy = {
  title: string; updated: string; labels: { updated: string; summary: string; contents: string }; summary: string[]; sections: LegalSection[];
  check: { title: string; intro: string; label: string; button: string; notFound: string; requested: string; completedAt: string; status: Record<DeletionStatus, string> };
};

const EMAIL = 'info@deepvisor.com';

const en: Copy = {
  title: 'Data deletion',
  updated: 'November 19, 2026',
  labels: { updated: 'Updated', summary: 'The short version', contents: 'Contents' },
  summary: [
    'Delete only what came from Meta: Connections → your Meta connection → Delete Meta data.',
    'Delete everything, including your DeepVisor account: Settings → Delete account.',
    'Removed DeepVisor in your Facebook settings? Meta tells us, we delete your Meta data automatically, and you get a confirmation code you can check below.',
    `Questions or another request: ${EMAIL}.`,
  ],
  sections: [
    { id: 'what-we-keep', title: 'What DeepVisor keeps from Meta', body: [
      'When you connect Meta, DeepVisor stores:',
      { list: [
        'Names and IDs of your ad accounts, Business accounts, Facebook Pages and linked Instagram accounts.',
        'Your campaigns, ad sets and ads: names, settings, budgets, schedules and delivery status.',
        'Ad creative: images, video posters and ad text.',
        'Performance numbers such as spend, impressions, clicks and results, and summarized audience breakdowns. Never the identity of people who saw your ads.',
        'If you connect WhatsApp: for each chat from your ads, the customer’s WhatsApp name, the last 4 digits of their number and the times of the first message and reply. Never message text.',
        'The access tokens that let DeepVisor read this on your behalf, and everything DeepVisor created from it (status history, insights, decisions, drafts).',
      ] },
    ] },
    { id: 'in-app', title: 'Delete it yourself in DeepVisor', body: [
      { list: [
        'Delete Meta data (owners and admins): open Connections, choose your Meta connection and select “Delete Meta data”. Everything listed above is deleted right away and the connection is disconnected. You get a confirmation code.',
        'Disconnect: stops all access and deletes the stored tokens, but keeps the data already synced so your reports still work if you reconnect.',
        'Delete account: Settings → Delete account removes your account and every workspace where you are the only member, with all of its data.',
      ] },
    ] },
    { id: 'in-facebook', title: 'Remove DeepVisor in Facebook', body: [
      'In Facebook, open Settings & privacy → Settings → Business integrations (or Apps and websites), remove DeepVisor and choose to have your data deleted.',
      'Meta sends DeepVisor a signed deletion request. DeepVisor deletes the Meta data of every connection you made and Meta shows you a link to this page with your confirmation code.',
    ] },
    { id: 'kept', title: 'What is not deleted with Meta data', body: [
      'Your DeepVisor login, your business profile and things you typed in yourself (for example weekly appointment answers and phone calls you logged) stay until you delete your account.',
    ] },
    { id: 'timing', title: 'Timing and copies', body: [
      'In-app deletions and requests from Meta are processed immediately. Copies held in our hosting providers’ backups are removed as those backups expire, within 30 days.',
      `For anything else, email ${EMAIL} from the address on your account.`,
    ] },
  ],
  check: {
    title: 'Check a deletion request', intro: 'Enter the confirmation code you received.', label: 'Confirmation code', button: 'Check',
    notFound: 'No request was found for that code. Check the code and try again.', requested: 'Requested', completedAt: 'Completed',
    status: {
      received: 'Received. Deletion is in progress.',
      completed: 'Completed. The Meta data for this request has been deleted.',
      no_data: 'Completed. DeepVisor had no Meta data for this account.',
      failed: `Not completed yet. We were notified and will finish it; you can also email ${EMAIL} with this code.`,
    },
  },
};

const es: Copy = {
  title: 'Eliminación de datos',
  updated: '19 de noviembre de 2026',
  labels: { updated: 'Actualizado', summary: 'En resumen', contents: 'Contenido' },
  summary: [
    'Eliminar solo lo que vino de Meta: Conexiones → tu conexión de Meta → Eliminar datos de Meta.',
    'Eliminar todo, incluida tu cuenta de DeepVisor: Configuración → Eliminar cuenta.',
    '¿Quitaste DeepVisor en la configuración de Facebook? Meta nos avisa, eliminamos tus datos de Meta automáticamente y recibes un código de confirmación que puedes consultar abajo.',
    `Preguntas u otra solicitud: ${EMAIL}.`,
  ],
  sections: [
    { id: 'what-we-keep', title: 'Qué guarda DeepVisor de Meta', body: [
      'Cuando conectas Meta, DeepVisor guarda:',
      { list: [
        'Nombres e IDs de tus cuentas publicitarias, cuentas comerciales, páginas de Facebook y cuentas de Instagram vinculadas.',
        'Tus campañas, conjuntos de anuncios y anuncios: nombres, configuración, presupuestos, fechas y estado de entrega.',
        'El contenido de los anuncios: imágenes, portadas de video y texto.',
        'Resultados como gasto, impresiones, clics y resultados, y desgloses de audiencia resumidos. Nunca la identidad de las personas que vieron tus anuncios.',
        'Si conectas WhatsApp: por cada chat de tus anuncios, el nombre de WhatsApp del cliente, los últimos 4 dígitos de su número y la hora del primer mensaje y de la respuesta. Nunca el texto de los mensajes.',
        'Los tokens de acceso que permiten a DeepVisor leer esto por ti, y todo lo que DeepVisor creó a partir de ello (historial de estado, avisos, decisiones, borradores).',
      ] },
    ] },
    { id: 'in-app', title: 'Elimínalo tú mismo en DeepVisor', body: [
      { list: [
        'Eliminar datos de Meta (dueños y administradores): abre Conexiones, elige tu conexión de Meta y selecciona “Eliminar datos de Meta”. Todo lo anterior se elimina de inmediato y la conexión se desconecta. Recibes un código de confirmación.',
        'Desconectar: detiene todo acceso y elimina los tokens guardados, pero conserva los datos ya sincronizados para que tus reportes sigan funcionando si vuelves a conectar.',
        'Eliminar cuenta: Configuración → Eliminar cuenta elimina tu cuenta y cada espacio de trabajo donde eres el único miembro, con todos sus datos.',
      ] },
    ] },
    { id: 'in-facebook', title: 'Quitar DeepVisor en Facebook', body: [
      'En Facebook, abre Configuración y privacidad → Configuración → Integraciones comerciales (o Apps y sitios web), quita DeepVisor y elige eliminar tus datos.',
      'Meta envía a DeepVisor una solicitud de eliminación firmada. DeepVisor elimina los datos de Meta de cada conexión que hiciste y Meta te muestra un enlace a esta página con tu código de confirmación.',
    ] },
    { id: 'kept', title: 'Lo que no se elimina con los datos de Meta', body: [
      'Tu acceso a DeepVisor, el perfil de tu negocio y lo que escribiste tú (por ejemplo, las respuestas semanales de citas y las llamadas que registraste) se conservan hasta que elimines tu cuenta.',
    ] },
    { id: 'timing', title: 'Tiempos y copias', body: [
      'Las eliminaciones dentro de la app y las solicitudes de Meta se procesan de inmediato. Las copias en los respaldos de nuestros proveedores se eliminan cuando esos respaldos vencen, en un plazo de 30 días.',
      `Para cualquier otra cosa, escribe a ${EMAIL} desde el correo de tu cuenta.`,
    ] },
  ],
  check: {
    title: 'Consultar una solicitud', intro: 'Ingresa el código de confirmación que recibiste.', label: 'Código de confirmación', button: 'Consultar',
    notFound: 'No encontramos una solicitud con ese código. Revisa el código e inténtalo de nuevo.', requested: 'Solicitada', completedAt: 'Completada',
    status: {
      received: 'Recibida. La eliminación está en proceso.',
      completed: 'Completada. Los datos de Meta de esta solicitud fueron eliminados.',
      no_data: 'Completada. DeepVisor no tenía datos de Meta de esta cuenta.',
      failed: `Aún no se completa. Ya fuimos notificados y la terminaremos; también puedes escribir a ${EMAIL} con este código.`,
    },
  },
};

export default async function DataDeletionPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const [locale, params] = await Promise.all([getLocale(), searchParams]);
  const copy = locale === 'es' ? es : en;
  const code = typeof params.code === 'string' ? params.code.trim().toUpperCase() : '';
  const result = code && isConfirmationCode(code) ? await deletionStatus(createAdminClient(), code).catch(() => null) : null;
  const when = (iso: string) => new Intl.DateTimeFormat(locale === 'es' ? 'es-US' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));

  return (
    <LegalDocument title={copy.title} lastUpdated={copy.updated} lastUpdatedISO="2026-11-19" summary={copy.summary} sections={copy.sections} labels={copy.labels}>
      <section className={classes.check} aria-labelledby="deletion-status">
        <h2 id="deletion-status">{copy.check.title}</h2>
        <p>{copy.check.intro}</p>
        <form method="get" className={classes.form}>
          <label htmlFor="deletion-code">{copy.check.label}</label>
          <div className={classes.row}>
            <input id="deletion-code" name="code" defaultValue={code} maxLength={12} autoComplete="off" spellCheck={false} />
            <button type="submit">{copy.check.button}</button>
          </div>
        </form>
        {code && (result ? (
          <div className={classes.result} role="status" data-status={result.status}>
            <p><strong>{copy.check.status[result.status]}</strong></p>
            <p>{copy.check.requested}: {when(result.requestedAt)}{result.completedAt ? ` · ${copy.check.completedAt}: ${when(result.completedAt)}` : ''}</p>
          </div>
        ) : <p className={classes.result} role="status">{copy.check.notFound}</p>)}
      </section>
    </LegalDocument>
  );
}
