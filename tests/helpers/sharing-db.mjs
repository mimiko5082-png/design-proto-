import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
export function sharingEnvironment() {
  const sqlite=new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys=ON;'+readFileSync(new URL('../../ai-service/migrations/0002_public_photos.sql',import.meta.url),'utf8'));
  const db={prepare(sql){const statement=sqlite.prepare(sql);let values=[];const query={bind(...args){values=args;return query;},async first(){return statement.get(...values)||null;},async all(){return {results:statement.all(...values)};},async run(){return {meta:{changes:Number(statement.run(...values).changes)}};}};return query;},async batch(queries){sqlite.exec('BEGIN');try{const results=[];for(const query of queries)results.push(await query.run());sqlite.exec('COMMIT');return results;}catch(error){sqlite.exec('ROLLBACK');throw error;}}};
  return {NOTIFICATIONS_DB:db,PUSH_RATE_LIMITER:{limit:async()=>({success:true})},ALLOWED_ORIGIN:'https://mimiko5082-png.github.io',sqlite};
}
