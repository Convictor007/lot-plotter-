import Papa from 'papaparse';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

import { extractBearingSegmentsFromTableCell } from '@/lib/ocr-survey-parse';

export interface ParsedCorner {
  ns: string;
  deg: string;
  min: string;
  sec?: string;
  ew: string;
  distance: string;
  segmentType?: 'line' | 'curve';
  curveRadius?: string;
  curveDelta?: string;
  curveChord?: string;
  curveDirection?: 'L' | 'R';
}

export const parseLotCsv = async (uri: string, fileObject?: any): Promise<ParsedCorner[]> => {
  let text = '';
  
  if (Platform.OS === 'web' && fileObject) {
    text = await fileObject.text();
  } else {
    // Native read
    text = await FileSystem.readAsStringAsync(uri);
  }

  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const corners: ParsedCorner[] = [];
        for (const row of results.data as any[]) {
          const bearingCell = (
            row['Bearing'] ||
            row['Bearings'] ||
            row['bearing_line'] ||
            row['LINE_TEXT'] ||
            row['Line text'] ||
            ''
          )
            .toString()
            .trim();
          if (bearingCell) {
            for (const s of extractBearingSegmentsFromTableCell(bearingCell)) {
              corners.push({ ns: s.ns, deg: s.deg, min: s.min, ew: s.ew, distance: s.distance });
            }
            continue;
          }

          // Flexible mapping for common CSV columns
          const ns = (row['NS'] || row['N/S'] || row['Direction 1'] || '').toString().trim().toUpperCase();
          const deg = (row['Deg'] || row['Degree'] || row['Degrees'] || '').toString().replace(/[^\d]/g, '');
          const min = (row['Min'] || row['Minute'] || row['Minutes'] || '').toString().replace(/[^\d]/g, '');
          const sec = (row['Sec'] || row['Second'] || row['Seconds'] || '').toString().replace(/[^\d]/g, '');
          const ew = (row['EW'] || row['E/W'] || row['Direction 2'] || '').toString().trim().toUpperCase();
          const distance = (row['Dist'] || row['Distance'] || row['Length'] || '').toString().replace(/[^\d.]/g, '');
          const segmentTypeRaw = (row['SegmentType'] || row['Type'] || row['segment_type'] || '').toString().trim().toLowerCase();
          const segmentType: 'line' | 'curve' =
            segmentTypeRaw === 'curve' || segmentTypeRaw === 'arc' ? 'curve' : 'line';
          const curveRadius = (row['CurveRadius'] || row['Radius'] || row['R'] || '').toString().replace(/[^\d.]/g, '');
          const curveDelta = (row['CurveDelta'] || row['Delta'] || row['D'] || '').toString().replace(/[^\d.]/g, '');
          const curveChord = (row['CurveChord'] || row['Chord'] || '').toString().replace(/[^\d.]/g, '');
          const curveDirRaw = (row['CurveDir'] || row['CurveDirection'] || row['Dir'] || '').toString().trim().toUpperCase();
          const curveDirection: 'L' | 'R' | undefined =
            curveDirRaw === 'L' || curveDirRaw === 'LEFT' ? 'L' : curveDirRaw === 'R' || curveDirRaw === 'RIGHT' ? 'R' : undefined;

          if ((ns === 'N' || ns === 'S') && deg && min && (ew === 'E' || ew === 'W') && distance) {
            corners.push({
              ns,
              deg,
              min,
              sec: sec || undefined,
              ew,
              distance,
              segmentType,
              curveRadius: curveRadius || undefined,
              curveDelta: curveDelta || undefined,
              curveChord: curveChord || undefined,
              curveDirection,
            });
          }
        }
        resolve(corners);
      },
      error: (error: any) => {
        reject(error);
      }
    });
  });
};
