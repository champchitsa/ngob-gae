export type SignalKey = 'new_after_act' | 'transfer_up' | 'transfer_down' | 'missing_execution' | 'low_execution' | 'over_execution' | 'vague_title'
export type SignalId = 'all' | SignalKey

export type AnomalyItem = {
  id: string
  score: number
  item: string
  agency: string
  ministry: string
  project: string
  act: number
  adjusted: number
  delta: number
  committed: number
  rate: number | null
  signals: SignalKey[]
}

export const signalQuestions: Record<SignalKey, string[]> = {
  new_after_act: [
    'วงเงินที่เกิดขึ้นหลัง พ.ร.บ. มาจากรายการใด และอนุมัติโดยใคร',
    'ขอบเขตงาน เป้าหมาย และตัวชี้วัดที่อนุมัติพร้อมการโอนคืออะไร',
  ],
  transfer_up: [
    'ขอคำสั่งโอนงบ เหตุผลความจำเป็น และรายการต้นทางที่ถูกลดวงเงิน',
    'เมื่อวงเงินเพิ่ม เป้าหมาย ปริมาณงาน หรือราคาต่อหน่วยเปลี่ยนอย่างไร',
  ],
  transfer_down: [
    'เหตุผลที่ลดวงเงินคือประหยัดจากจัดซื้อ ชะลอโครงการ หรือยกเลิกงาน',
    'ผลผลิตที่เหลือหลังลดวงเงินยังเท่าเดิมหรือถูกปรับลงเท่าใด',
  ],
  missing_execution: [
    'ช่องว่างหมายถึงยังไม่รายงาน หรือไม่มีการใช้จ่ายจริงในช่วงข้อมูลนี้',
    'ขอทะเบียน PO สัญญา ใบส่งมอบ และยอดเบิกจากระบบบัญชีมาเทียบ',
  ],
  low_execution: [
    'งวดงานใดล่าช้า สาเหตุคือการจัดซื้อ ผู้รับจ้าง พื้นที่ หรือการส่งมอบ',
    'มีการขยายเวลา ปรับแผน หรือกันเงินไว้เบิกเหลื่อมปีเท่าใด',
  ],
  over_execution: [
    'ยอดรวม PO และเบิกจ่ายซ้ำกันระหว่างคอลัมน์หรือรวมคนละช่วงเวลาหรือไม่',
    'ขอรายละเอียดบัญชีระดับรายการเพื่อกระทบยอดกับวงเงินหลังโอน',
  ],
  vague_title: [
    'ขอรายการย่อย TOR จำนวน หน่วย ราคาต่อหน่วย และผู้รับผิดชอบ',
    'รหัสหรือชื่อรวมนี้เชื่อมกับสัญญาและผลส่งมอบใดบ้าง',
  ],
}

export const bigData: {
  meta: { rows: number; sourceUrl: string }
  overview: { positiveRows: number; rowsOver20m: number; median: number; topOnePercentShare: number; gini: number }
  flags: { id: SignalKey; label: string; definition: string; count: number; amount: number }[]
  themes: { id: string; label: string; rows: number; adjusted: number; rate: number }[]
  agencies: { agency: string; adjusted: number; share: number; rate: number }[]
  repeatedPatterns: { pattern: string; count: number; agencies: number; adjusted: number }[]
  items: AnomalyItem[]
} = {
  meta: {
    rows: 241159,
    sourceUrl: 'https://drive.google.com/file/d/1f-lfPEsutobU6iB8W4LY1bThfhvYheHJ/view',
  },
  overview: {
    positiveRows: 193783,
    rowsOver20m: 10609,
    median: 0.499,
    topOnePercentShare: 80.3,
    gini: 0.957,
  },
  flags: [
    { id: 'new_after_act', label: 'วงเงินเกิดใหม่หลัง พ.ร.บ.', definition: 'วงเงินตาม พ.ร.บ. เป็นศูนย์หรือว่าง และวงเงินหลังโอนตั้งแต่ 20 ล้านบาท', count: 1569, amount: 317825.8726 },
    { id: 'transfer_up', label: 'โอนเพิ่มอย่างน้อย 25%', definition: 'วงเงินเพิ่มอย่างน้อย 20 ล้านบาทและไม่น้อยกว่า 25% ของวงเงินตั้งต้น', count: 222, amount: 59453.3989 },
    { id: 'transfer_down', label: 'ลดวงเงินอย่างน้อย 25%', definition: 'วงเงินลดอย่างน้อย 20 ล้านบาทและไม่น้อยกว่า 25% ของวงเงินตั้งต้น', count: 216, amount: 75385.0334 },
    { id: 'missing_execution', label: 'ไม่มีตัวเลขใช้จ่ายระดับแถว', definition: 'วงเงินหลังโอนตั้งแต่ 50 ล้านบาท แต่ PO และยอดเบิกจ่ายระดับแถวไม่มีค่าตัวเลข', count: 352, amount: 582821.7149 },
    { id: 'low_execution', label: 'ใช้จ่ายต่ำกว่า 35%', definition: 'วงเงินหลังโอนตั้งแต่ 50 ล้านบาท มีข้อมูลใช้จ่าย และอัตรารวม PO ต่ำกว่า 35%', count: 524, amount: 75921.5722 },
    { id: 'over_execution', label: 'ใช้จ่ายเกินวงเงินหลังโอน 5%', definition: 'ยอดรวมเบิกจ่ายและ PO สูงกว่าวงเงินหลังโอนเกิน 5%', count: 65, amount: 143974.7211 },
    { id: 'vague_title', label: 'ชื่อรายการกว้างหรือเป็นรหัส', definition: 'รายการตั้งแต่ 20 ล้านบาทที่ชื่อเป็นหมวดกว้าง รหัสสั้น หรือข้อความสั้นมาก', count: 675, amount: 201547.1158 },
  ],
  themes: [
    { id: 'ict', label: 'ICT และดิจิทัล', rows: 11113, adjusted: 62077.7247, rate: 77.7 },
    { id: 'construction', label: 'ที่ดินและสิ่งก่อสร้าง', rows: 77283, adjusted: 488197.6646, rate: 67.7 },
    { id: 'training', label: 'ฝึกอบรมและพัฒนาบุคลากร', rows: 764, adjusted: 7038.8128, rate: 76.4 },
    { id: 'consulting', label: 'ที่ปรึกษาและงานศึกษา', rows: 698, adjusted: 27139.3504, rate: 93.3 },
  ],
  agencies: [
    { agency: 'งบกลาง', adjusted: 829001.7117, share: 22.09, rate: 89.4 },
    { agency: 'สำนักงานบริหารหนี้สาธารณะ', adjusted: 356071.5869, share: 9.49, rate: 100 },
    { agency: 'สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน', adjusted: 274930.8024, share: 7.33, rate: 99.1 },
    { agency: 'กองทุนและเงินทุนหมุนเวียน', adjusted: 250958.1526, share: 6.69, rate: 100 },
    { agency: 'กรมส่งเสริมการปกครองท้องถิ่น', adjusted: 175757.8741, share: 4.68, rate: 93.8 },
    { agency: 'กรมทางหลวง', adjusted: 127501.0605, share: 3.4, rate: 80.8 },
    { agency: 'สำนักงานตำรวจแห่งชาติ', adjusted: 124354.7312, share: 3.31, rate: 93.6 },
    { agency: 'สำนักงานปลัดกระทรวงสาธารณสุข', adjusted: 120870.1517, share: 3.22, rate: 104.2 },
    { agency: 'กองทัพบก', adjusted: 95895.9474, share: 2.56, rate: 85.5 },
    { agency: 'กรมชลประทาน', adjusted: 82746.7291, share: 2.2, rate: 87.8 },
    { agency: 'สำนักงานประกันสังคม', adjusted: 62314.7202, share: 1.66, rate: 100.1 },
    { agency: 'กรมทางหลวงชนบท', adjusted: 50643.4894, share: 1.35, rate: 89.5 },
  ],
  repeatedPatterns: [
    { pattern: 'รายการงบบุคลากร', count: 245, agencies: 228, adjusted: 631804.3752 },
    { pattern: 'รายการงบดำเนินงาน (รายจ่ายประจำ)', count: 1278, agencies: 306, adjusted: 125662.494 },
    { pattern: 'เงินอุดหนุนการสงเคราะห์เบี้ยยังชีพผู้สูงอายุ', count: 2481, agencies: 2299, adjusted: 94249.5369 },
    { pattern: 'อัตราเดิม', count: 86, agencies: 83, adjusted: 61403.5877 },
    { pattern: 'ค่าจัดการเรียนการสอน', count: 3446, agencies: 2380, adjusted: 61334.7128 },
    { pattern: 'เงินสมทบกองทุนประกันสังคม', count: 11, agencies: 11, adjusted: 60223.6328 },
    { pattern: 'ค่าใช้จ่ายบุคลากร', count: 51, agencies: 50, adjusted: 44469.2594 },
    { pattern: 'เงินอุดหนุนดำเนินการตามอำนาจหน้าที่และภารกิจถ่ายโอน', count: 5119, agencies: 2368, adjusted: 42084.854 },
  ],
  items: [
    { id: 'b4baf1e83d27', score: 96, item: 'ทอ.114', agency: 'กองทัพอากาศ', ministry: 'กระทรวงกลาโหม', project: 'โครงการพัฒนาขีดความสามารถของกองทัพ', act: 0, adjusted: 845.9083, delta: 845.9083, committed: 0, rate: 0, signals: ['new_after_act', 'low_execution', 'vague_title'] },
    { id: '7a91a98d9d6b', score: 89, item: 'ทอ.125', agency: 'กองทัพอากาศ', ministry: 'กระทรวงกลาโหม', project: 'โครงการพัฒนาขีดความสามารถของกองทัพ', act: 0, adjusted: 525, delta: 525, committed: 0, rate: null, signals: ['new_after_act', 'missing_execution', 'vague_title'] },
    { id: 'd5045c796cdb', score: 89, item: 'ทอ.116', agency: 'กองทัพอากาศ', ministry: 'กระทรวงกลาโหม', project: 'โครงการพัฒนาขีดความสามารถของกองทัพ', act: 0, adjusted: 164.5, delta: 164.5, committed: 17.2786, rate: 10.5, signals: ['new_after_act', 'low_execution', 'vague_title'] },
    { id: 'c48a26db5c85', score: 87, item: 'ทร.258', agency: 'กองทัพเรือ', ministry: 'กระทรวงกลาโหม', project: 'โครงการพัฒนาขีดความสามารถของกองทัพ', act: 0, adjusted: 98.003, delta: 98.003, committed: 3.5299, rate: 3.6, signals: ['new_after_act', 'low_execution', 'vague_title'] },
    { id: '2e23a963422c', score: 86, item: 'รายการงบดำเนินงาน (รายจ่ายประจำ)', agency: 'สำนักงานปลัดกระทรวงดิจิทัลเพื่อเศรษฐกิจและสังคม', ministry: 'กระทรวงดิจิทัลเพื่อเศรษฐกิจและสังคม', project: 'การส่งเสริมและสนับสนุนการใช้เทคโนโลยีสารสนเทศและการสื่อสาร', act: 0.9173, adjusted: 71.1523, delta: 70.235, committed: 5.8775, rate: 8.3, signals: ['transfer_up', 'low_execution', 'vague_title'] },
    { id: 'f4f621706d69', score: 86, item: 'ทอ.117', agency: 'กองทัพอากาศ', ministry: 'กระทรวงกลาโหม', project: 'โครงการพัฒนาขีดความสามารถของกองทัพ', act: 0, adjusted: 73.44, delta: 73.44, committed: 0, rate: 0, signals: ['new_after_act', 'low_execution', 'vague_title'] },
    { id: 'caf5c57d9b7f', score: 84, item: 'ทอ.120', agency: 'กองทัพอากาศ', ministry: 'กระทรวงกลาโหม', project: 'โครงการพัฒนาขีดความสามารถของกองทัพ', act: 0, adjusted: 170.73, delta: 170.73, committed: 0, rate: null, signals: ['new_after_act', 'missing_execution', 'vague_title'] },
    { id: '731ea645862f', score: 83, item: 'ทอ.200', agency: 'กองทัพอากาศ', ministry: 'กระทรวงกลาโหม', project: 'โครงการพัฒนาขีดความสามารถของกองทัพ', act: 368.8858, adjusted: 571.304, delta: 202.4182, committed: 98.6161, rate: 17.3, signals: ['transfer_up', 'low_execution', 'vague_title'] },
    { id: 'c5ba49810517', score: 83, item: 'ทบ.110', agency: 'กองทัพบก', ministry: 'กระทรวงกลาโหม', project: 'โครงการพัฒนาขีดความสามารถของกองทัพ', act: 0, adjusted: 130.6008, delta: 130.6008, committed: 0, rate: null, signals: ['new_after_act', 'missing_execution', 'vague_title'] },
    { id: '707d85cb7c81', score: 79, item: 'เพื่อฟื้นฟูโครงสร้างพื้นฐานที่ได้รับความเสียหายจากอุทกภัยและภัยพิบัติ จำนวน 74 รายการ', agency: 'งบกลาง', ministry: 'งบกลาง', project: 'เงินสำรองจ่ายเพื่อกรณีฉุกเฉินหรือจำเป็น', act: 0, adjusted: 1619.8189, delta: 1619.8189, committed: 93.8063, rate: 5.8, signals: ['new_after_act', 'low_execution'] },
    { id: '8e769e3b3ea4', score: 70, item: 'เงินอุดหนุนบริการสาธารณะ (PSO)', agency: 'การรถไฟแห่งประเทศไทย', ministry: 'รัฐวิสาหกิจ', project: 'โครงการเงินอุดหนุนบริการสาธารณะ (PSO)', act: 1464.0259, adjusted: 693.1948, delta: -770.8311, committed: 0, rate: null, signals: ['transfer_down', 'missing_execution'] },
    { id: '9f7732b2e709', score: 69, item: 'เงินสำรอง เงินสมทบ และเงินชดเชยของข้าราชการ', agency: 'งบกลาง', ministry: 'งบกลาง', project: 'เงินสำรอง เงินสมทบ และเงินชดเชยของข้าราชการ', act: 82775, adjusted: 51675, delta: -31100, committed: 0, rate: null, signals: ['transfer_down', 'missing_execution'] },
    { id: 'a607c8a5b42b', score: 69, item: 'ก่อสร้างทางแนวใหม่ สายแยกทางหลวงหมายเลข 9 (บ.บางเตย) - บรรจบทางหลวงหมายเลข 3214 (บ.พร้าว) ตอน 4 จ.ปทุมธานี', agency: 'กรมทางหลวง', ministry: 'กระทรวงคมนาคม', project: 'โครงการก่อสร้างโครงข่ายทางหลวงแผ่นดิน', act: 493.5667, adjusted: 172.7961, delta: -320.7706, committed: 20.985, rate: 12.1, signals: ['transfer_down', 'low_execution'] },
    { id: '0537b84aa5de', score: 67, item: 'ก่อสร้างทางหลวงหมายเลข 4027 สายท่าเรือ - เมืองใหม่ ตอน บ.พารา - บ.เมืองใหม่ จ.ภูเก็ต', agency: 'กรมทางหลวง', ministry: 'กระทรวงคมนาคม', project: 'โครงการก่อสร้างโครงข่ายทางหลวงแผ่นดิน', act: 230.208, adjusted: 97.9745, delta: -132.2335, committed: 9.0296, rate: 9.2, signals: ['transfer_down', 'low_execution'] },
    { id: 'cc794dda3a34', score: 66, item: 'แนวป้องกันช้างป่า (คูกันช้างป่าเดิมแบบดาดคอนกรีต) เขตรักษาพันธุ์สัตว์ป่าเขาอ่างฤๅไน ตำบลท่าตะเกียบ อำเภอท่าตะเกียบ จังหวัดฉะเชิงเทรา', agency: 'กรมอุทยานแห่งชาติ สัตว์ป่า และพันธุ์พืช', ministry: 'กระทรวงทรัพยากรธรรมชาติและสิ่งแวดล้อม', project: 'โครงการรักษาความมั่นคงของฐานทรัพยากรธรรมชาติ', act: 43.4, adjusted: 85.6, delta: 42.2, committed: 0, rate: 0, signals: ['transfer_up', 'low_execution'] },
    { id: '3dfa803fa5bf', score: 66, item: 'ค่าใช้จ่ายในการดำเนินงานจัดการแสดงการฝึกทางทหารประกอบดนตรี "ราชวัลลภเริงระบำ" (Hop To The Bodies Slams) ประจำปี พ.ศ. 2568', agency: 'งบกลาง', ministry: 'งบกลาง', project: 'เงินสำรองจ่ายเพื่อกรณีฉุกเฉินหรือจำเป็น', act: 0, adjusted: 80.3868, delta: 80.3868, committed: 2.8285, rate: 3.5, signals: ['new_after_act', 'low_execution'] },
    { id: '61b4cf6660dc', score: 65, item: 'รายการงบดำเนินงาน (รายจ่ายประจำ)', agency: 'กรมควบคุมโรค', ministry: 'กระทรวงสาธารณสุข', project: 'โครงการเร่งรัดพัฒนาระบบเฝ้าระวัง ป้องกัน ควบคุมโรคและภัยสุขภาพ', act: 120.2617, adjusted: 232.2928, delta: 112.0311, committed: 203.1011, rate: 87.4, signals: ['transfer_up', 'vague_title'] },
    { id: '2fbe505dfb1b', score: 65, item: 'ค่าใช้จ่ายเพื่อการกระตุ้นเศรษฐกิจและสร้างความเข้มแข็งของระบบเศรษฐกิจ', agency: 'งบกลาง', ministry: 'งบกลาง', project: 'ค่าใช้จ่ายเพื่อการกระตุ้นเศรษฐกิจและสร้างความเข้มแข็งของระบบเศรษฐกิจ', act: 187700, adjusted: 186.6801, delta: -187513.3199, committed: 0, rate: null, signals: ['transfer_down', 'missing_execution'] },
    { id: '27ae04bf47f1', score: 48, item: 'รายการงบบุคลากร', agency: 'สำนักงานปลัดกระทรวงสาธารณสุข', ministry: 'กระทรวงสาธารณสุข', project: 'รายการค่าใช้จ่ายบุคลากรภาครัฐ พัฒนาด้านสาธารณสุข และสร้างเสริมสุขภาพเชิงรุก', act: 94225.7955, adjusted: 94225.7955, delta: 0, committed: 103800.3088, rate: 110.2, signals: ['over_execution'] },
    { id: 'fbbf9b1ceb50', score: 48, item: 'รายการงบบุคลากร', agency: 'สำนักงานคณะกรรมการการอาชีวศึกษา', ministry: 'กระทรวงศึกษาธิการ', project: 'รายการค่าใช้จ่ายบุคลากรภาครัฐ', act: 9399.6614, adjusted: 9417.9048, delta: 18.2434, committed: 10356.958, rate: 110, signals: ['over_execution'] },
    { id: 'df7bc148a70a', score: 48, item: 'รายการงบบุคลากร', agency: 'กรมราชทัณฑ์', ministry: 'กระทรวงยุติธรรม', project: 'รายการค่าใช้จ่ายบุคลากรภาครัฐ ปฏิรูปกฎหมายและพัฒนากระบวนการยุติธรรม', act: 5644.9404, adjusted: 5654.9976, delta: 10.0572, committed: 6058.5085, rate: 107.1, signals: ['over_execution'] },
    { id: 'd0ac0fa58279', score: 48, item: 'รายการงบบุคลากร', agency: 'กรมการแพทย์', ministry: 'กระทรวงสาธารณสุข', project: 'รายการค่าใช้จ่ายบุคลากรภาครัฐ พัฒนาด้านสาธารณสุข และสร้างเสริมสุขภาพเชิงรุก', act: 4688.0306, adjusted: 4715.4193, delta: 27.3887, committed: 5070.2007, rate: 107.5, signals: ['over_execution'] },
  ],
}
