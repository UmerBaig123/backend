import { Bid } from '../models/bid.js';
import Project from '../models/project.js';

// Get Dashboard Data
export const getDashboardData = async (req, res) => {
    try {
        console.log('=== GET DASHBOARD DATA API CALLED ===');
        console.log('User ID:', req.session.userId);
        console.log('Timestamp:', new Date().toISOString());

        const userId = req.session.userId;

        // Calculate Total Revenue - sum of all bid project totals
        const totalRevenueResult = await Bid.aggregate([
            { $match: { user: userId } },
            {
                $group: {
                    _id: null,
                    totalRevenue: {
                        $sum: {
                            $cond: [
                                { $gt: ['$totalAmount', 0] },
                                '$totalAmount',
                                0
                            ]
                        }
                    }
                }
            }
        ]);

        const totalRevenue = totalRevenueResult.length > 0 ? totalRevenueResult[0].totalRevenue : 0;

        // Count Active Projects - projects with status 'active' from Project model
        const activeProjectsCount = await Project.countDocuments({
            createdBy: userId,
            status: 'active'
        });

        // Calculate Bid Win Rate - approved bids / total bids
        const bidStats = await Bid.aggregate([
            { $match: { user: userId } },
            {
                $group: {
                    _id: null,
                    totalBids: { $sum: 1 },
                    approvedBids: {
                        $sum: {
                            $cond: [
                                { $eq: ['$status', 'approved'] },
                                1,
                                0
                            ]
                        }
                    }
                }
            }
        ]);

        const totalBids = bidStats.length > 0 ? bidStats[0].totalBids : 0;
        const approvedBids = bidStats.length > 0 ? bidStats[0].approvedBids : 0;
        const bidWinRate = totalBids > 0 ? ((approvedBids / totalBids) * 100).toFixed(1) : 0;

        // Get total projects count
        const totalProjects = await Project.countDocuments({ createdBy: userId });

        // Additional useful metrics
        const recentBids = await Bid.find({ user: userId })
            .sort({ createdAt: -1 })
            .limit(5)
            .select('projectName status totalAmount createdAt')
            .lean();

        // Get recent projects
        const recentProjects = await Project.find({ createdBy: userId })
            .sort({ createdAt: -1 })
            .limit(5)
            .select('projectName clientName projectType status budget createdAt')
            .lean();

        const statusBreakdown = await Bid.aggregate([
            { $match: { user: userId } },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Get project status breakdown
        const projectStatusBreakdown = await Project.aggregate([
            { $match: { createdBy: userId } },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Calculate average bid amount
        const averageBidResult = await Bid.aggregate([
            { $match: { user: userId, totalAmount: { $gt: 0 } } },
            {
                $group: {
                    _id: null,
                    averageBid: { $avg: '$totalAmount' }
                }
            }
        ]);

        const averageBidAmount = averageBidResult.length > 0 ? averageBidResult[0].averageBid : 0;

        // Calculate monthly revenue for the current year
        const currentYear = new Date().getFullYear();
        const monthlyRevenue = await Bid.aggregate([
            {
                $match: {
                    user: userId,
                    createdAt: {
                        $gte: new Date(currentYear, 0, 1),
                        $lt: new Date(currentYear + 1, 0, 1)
                    },
                    totalAmount: { $gt: 0 }
                }
            },
            {
                $group: {
                    _id: { $month: '$createdAt' },
                    monthlyTotal: { $sum: '$totalAmount' }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Format monthly revenue data
        const monthlyRevenueData = Array.from({ length: 12 }, (_, index) => {
            const monthData = monthlyRevenue.find(item => item._id === index + 1);
            return {
                month: index + 1,
                monthName: new Date(currentYear, index).toLocaleString('default', { month: 'short' }),
                revenue: monthData ? monthData.monthlyTotal : 0
            };
        });

        console.log('Dashboard data calculated successfully');
        console.log(`Total Revenue: $${totalRevenue.toFixed(2)}`);
        console.log(`Active Projects: ${activeProjectsCount}`);
        console.log(`Total Projects: ${totalProjects}`);
        console.log(`Bid Win Rate: ${bidWinRate}%`);
        console.log(`Total Bids: ${totalBids}`);

        res.json({
            success: true,
            data: {
                // Main metrics
                totalRevenue: totalRevenue,
                activeProjects: activeProjectsCount,
                totalProjects: totalProjects,
                bidWinRate: parseFloat(bidWinRate),
                totalBids: totalBids,
                approvedBids: approvedBids,
                averageBidAmount: averageBidAmount,

                // Additional insights
                recentBids: recentBids,
                recentProjects: recentProjects,
                statusBreakdown: statusBreakdown,
                projectStatusBreakdown: projectStatusBreakdown,
                monthlyRevenue: monthlyRevenueData,

                // Summary stats
                summary: {
                    totalRevenueFormatted: `$${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                    averageBidFormatted: `$${averageBidAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                    winRateFormatted: `${bidWinRate}%`,
                    activeProjectsFormatted: `${activeProjectsCount} active project${activeProjectsCount !== 1 ? 's' : ''}`,
                    totalProjectsFormatted: `${totalProjects} total project${totalProjects !== 1 ? 's' : ''}`
                }
            }
        });

    } catch (error) {
        console.error('=== GET DASHBOARD DATA ERROR ===');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        
        res.status(500).json({
            success: false,
            message: 'Error fetching dashboard data',
            error: error.message
        });
    }
};

// Get Dashboard Chart Data (for additional charts if needed)
export const getDashboardChartData = async (req, res) => {
    try {
        console.log('=== GET DASHBOARD CHART DATA API CALLED ===');
        console.log('User ID:', req.session.userId);

        const userId = req.session.userId;
        const { period = 'year' } = req.query; // year, month, week

        let dateFilter = {};
        const now = new Date();

        switch (period) {
            case 'month':
                dateFilter = {
                    $gte: new Date(now.getFullYear(), now.getMonth(), 1),
                    $lt: new Date(now.getFullYear(), now.getMonth() + 1, 1)
                };
                break;
            case 'week':
                const weekStart = new Date(now);
                weekStart.setDate(now.getDate() - now.getDay());
                weekStart.setHours(0, 0, 0, 0);
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekStart.getDate() + 7);
                dateFilter = { $gte: weekStart, $lt: weekEnd };
                break;
            default: // year
                dateFilter = {
                    $gte: new Date(now.getFullYear(), 0, 1),
                    $lt: new Date(now.getFullYear() + 1, 0, 1)
                };
        }

        // Revenue over time
        const revenueOverTime = await Bid.aggregate([
            {
                $match: {
                    user: userId,
                    createdAt: dateFilter,
                    totalAmount: { $gt: 0 }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' },
                        day: period === 'week' ? { $dayOfMonth: '$createdAt' } : null
                    },
                    revenue: { $sum: '$totalAmount' },
                    bidCount: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
        ]);

        // Status distribution
        const statusDistribution = await Bid.aggregate([
            { $match: { user: userId, createdAt: dateFilter } },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    totalValue: { $sum: '$totalAmount' }
                }
            }
        ]);

        res.json({
            success: true,
            data: {
                period: period,
                revenueOverTime: revenueOverTime,
                statusDistribution: statusDistribution
            }
        });

    } catch (error) {
        console.error('=== GET DASHBOARD CHART DATA ERROR ===');
        console.error('Error:', error.message);
        
        res.status(500).json({
            success: false,
            message: 'Error fetching dashboard chart data',
            error: error.message
        });
    }
};
