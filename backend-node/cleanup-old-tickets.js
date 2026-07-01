/**
 * Delete all tickets except today's (by ticket_date).
 * Also removes related history, attachments, and upload files.
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

async function run() {
  const pool = await mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root123',
    database: process.env.DB_NAME || 'ticketing_db',
  });

  const [[{ today }]] = await pool.query('SELECT CURDATE() AS today');
  console.log(`\nKeeping tickets with ticket_date = ${today}\n`);

  const [toDelete] = await pool.query(
    'SELECT id, ticket_no, ticket_date FROM tickets WHERE ticket_date <> ? OR ticket_date IS NULL',
    [today]
  );
  const [toKeep] = await pool.query(
    'SELECT id, ticket_no, ticket_date FROM tickets WHERE ticket_date = ?',
    [today]
  );

  console.log(`Tickets to keep (${toKeep.length}):`);
  toKeep.forEach((t) => console.log(`  #${t.id} ${t.ticket_no} (${String(t.ticket_date).split('T')[0]})`));

  console.log(`\nTickets to delete (${toDelete.length}):`);
  toDelete.forEach((t) => console.log(`  #${t.id} ${t.ticket_no} (${String(t.ticket_date).split('T')[0]})`));

  if (!toDelete.length) {
    console.log('\nNo old tickets to delete.\n');
    await pool.end();
    return;
  }

  const ids = toDelete.map((t) => t.id);
  const placeholders = ids.map(() => '?').join(',');

  const [attachments] = await pool.query(
    `SELECT id, file_path FROM ticket_attachments WHERE ticket_id IN (${placeholders})`,
    ids
  );

  for (const att of attachments) {
    const filePath = path.join(__dirname, '..', att.file_path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`  Removed file: ${att.file_path}`);
    }
  }

  const [hist] = await pool.query(
    `DELETE FROM ticket_history WHERE ticket_id IN (${placeholders})`,
    ids
  );
  const [atts] = await pool.query(
    `DELETE FROM ticket_attachments WHERE ticket_id IN (${placeholders})`,
    ids
  );
  const [tix] = await pool.query(
    `DELETE FROM tickets WHERE id IN (${placeholders})`,
    ids
  );

  console.log(`\nDeleted: ${tix.affectedRows} tickets, ${hist.affectedRows} history rows, ${atts.affectedRows} attachments`);

  const [remaining] = await pool.query('SELECT COUNT(*) AS c FROM tickets');
  console.log(`Remaining tickets: ${remaining[0].c}\n`);

  await pool.end();
}

run().catch((err) => {
  console.error('Cleanup failed:', err.message);
  process.exit(1);
});
