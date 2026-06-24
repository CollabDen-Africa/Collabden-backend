const prisma = require('../config/prismaClient');
const xlsx = require('xlsx');

const joinWaitlist = async (req, res) => {
  try {
    const { email, name, phoneNumber } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    if (typeof email !== 'string') {
      return res.status(400).json({ error: 'Email must be a string' });
    }

    if (name !== undefined && typeof name !== 'string') {
      return res.status(400).json({ error: 'Name must be a string' });
    }

    if (phoneNumber !== undefined && typeof phoneNumber !== 'string') {
      return res.status(400).json({ error: 'Phone number must be a string' });
    }

    // Basic server-side email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    const existingEntry = await prisma.waitlistEntry.findUnique({
      where: { email },
    });

    if (existingEntry) {
      return res.status(400).json({ error: 'Email already exists on the waitlist' });
    }

    await prisma.waitlistEntry.create({
      data: {
        email,
        name,
        phoneNumber,
      },
    });

    return res.status(200).json({ message: 'Success' });
  } catch (error) {
    console.error('Waitlist join error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const getWaitlist = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const search = req.query.search?.trim() || '';
    const skip = (page - 1) * limit;

    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [entries, total] = await Promise.all([
      prisma.waitlistEntry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          name: true,
          phoneNumber: true,
          createdAt: true,
        },
      }),
      prisma.waitlistEntry.count({ where }),
    ]);

    return res.status(200).json({
      data: entries,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Waitlist fetch error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const downloadWaitlist = async (req, res) => {
  try {
    const entries = await prisma.waitlistEntry.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // Convert entries to worksheet format
    const worksheetData = entries.map((entry) => ({
      ID: entry.id,
      Name: entry.name || '',
      Email: entry.email,
      'Phone Number': entry.phoneNumber || '',
      'Joined At': entry.createdAt.toISOString(),
    }));

    const worksheet = xlsx.utils.json_to_sheet(worksheetData);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Waitlist');

    // Generate buffer
    const excelBuffer = xlsx.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    res.setHeader('Content-Disposition', 'attachment; filename="waitlist.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    
    return res.send(excelBuffer);
  } catch (error) {
    console.error('Waitlist download error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  joinWaitlist,
  getWaitlist,
  downloadWaitlist,
};
