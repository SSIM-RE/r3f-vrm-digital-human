/**
 * HumanML3D -> VRM 骨骼转换器
 * 修正版：处理分叉点骨骼
 */

import * as THREE from 'three'

// HML索引 → VRM关节（骨骼起点）→ 骨骼终点
export const BONE_CONFIG = {
  0: { vrm: 'hips', child: 'spine', children: ['spine', 'leftUpperLeg', 'rightUpperLeg'] },
  1: { vrm: 'rightUpperLeg', child: 'rightLowerLeg' },
  2: { vrm: 'leftUpperLeg', child: 'leftLowerLeg' },
  3: { vrm: 'spine', child: 'chest', children: ['chest'] },
  4: { vrm: 'rightLowerLeg', child: 'rightFoot' },
  5: { vrm: 'leftLowerLeg', child: 'leftFoot' },
  6: { vrm: 'chest', child: 'upperChest', children: ['upperChest'] },
  7: { vrm: 'rightFoot', child: 'rightToes' },
  8: { vrm: 'leftFoot', child: 'leftToes' },
  9: { vrm: 'upperChest', child: 'neck', children: ['neck', 'leftShoulder', 'rightShoulder'] },
  10: { vrm: 'rightToes', child: null },
  11: { vrm: 'leftToes', child: null },
  12: { vrm: 'neck', child: 'head', children: ['head'] },
  13: { vrm: 'rightShoulder', child: 'rightUpperArm' },
  14: { vrm: 'leftShoulder', child: 'leftUpperArm' },
  15: { vrm: 'head', child: null },
  16: { vrm: 'rightUpperArm', child: 'rightLowerArm' },
  17: { vrm: 'leftUpperArm', child: 'leftLowerArm' },
  18: { vrm: 'rightLowerArm', child: 'rightHand' },
  19: { vrm: 'leftLowerArm', child: 'leftHand' },
  20: { vrm: 'rightHand', child: null },
  21: { vrm: 'leftHand', child: null },
}

// VRM → HML 逆映射
const VRM_TO_HML = {}
Object.entries(BONE_CONFIG).forEach(([hmlIdx, config]) => {
  VRM_TO_HML[config.vrm] = parseInt(hmlIdx)
})

// HML 子骨骼映射
const HML_CHILD_MAP = {
  0: 3, 1: 4, 2: 5, 3: 6, 4: 7, 5: 8,
  6: 9, 7: 10, 8: 11, 9: 12, 12: 15,
  13: 16, 14: 17, 16: 18, 17: 19, 18: 20, 19: 21,
}

// VRM 骨骼层级（父 -> 子）
const VRM_PARENT_MAP = {
  'hips': null,
  'spine': 'hips',
  'chest': 'spine',
  'upperChest': 'chest',
  'neck': 'upperChest',
  'head': 'neck',
  'leftShoulder': 'upperChest',
  'leftUpperArm': 'leftShoulder',
  'leftLowerArm': 'leftUpperArm',
  'leftHand': 'leftLowerArm',
  'rightShoulder': 'upperChest',
  'rightUpperArm': 'rightShoulder',
  'rightLowerArm': 'rightUpperArm',
  'rightHand': 'rightLowerArm',
  'leftUpperLeg': 'hips',
  'leftLowerLeg': 'leftUpperLeg',
  'leftFoot': 'leftLowerLeg',
  'leftToes': 'leftFoot',
  'rightUpperLeg': 'hips',
  'rightLowerLeg': 'rightUpperLeg',
  'rightFoot': 'rightLowerLeg',
  'rightToes': 'rightFoot',
}

// VRM 骨骼处理顺序（从根到叶）
const BONE_ORDER = [
  'hips',
  'spine', 'chest', 'upperChest', 'neck', 'head',
  'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand',
  'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand',
  'leftUpperLeg', 'leftLowerLeg', 'leftFoot', 'leftToes',
  'rightUpperLeg', 'rightLowerLeg', 'rightFoot', 'rightToes',
]

// 存储 VRM T-Pose 时的骨骼方向
let vrmTPoseDirs = {}

/**
 * 捕获 VRM T-Pose 时的骨骼方向
 */
export function captureVRMDirs(vrm) {
  vrmTPoseDirs = {}
  
  console.log('=== 捕获 VRM T-Pose 骨骼方向 ===')
  
  BONE_ORDER.forEach(vrmBoneName => {
    const config = Object.values(BONE_CONFIG).find(c => c.vrm === vrmBoneName)
    if (!config) return
    
    const boneNode = vrm.humanoid.getNormalizedBoneNode(vrmBoneName)
    
    if (!config.child) {
      vrmTPoseDirs[vrmBoneName] = new THREE.Vector3(0, 1, 0)
      return
    }
    
    const childNode = vrm.humanoid.getNormalizedBoneNode(config.child)
    
    if (boneNode && childNode) {
      const startPos = new THREE.Vector3()
      const endPos = new THREE.Vector3()
      boneNode.getWorldPosition(startPos)
      childNode.getWorldPosition(endPos)
      
      const dir = endPos.clone().sub(startPos).normalize()
      vrmTPoseDirs[vrmBoneName] = dir
      
      console.log(`${vrmBoneName} -> ${config.child}: [${dir.x.toFixed(4)}, ${dir.y.toFixed(4)}, ${dir.z.toFixed(4)}]`)
    }
  })
  
  console.log('=====================================')
  
  return vrmTPoseDirs
}

/**
 * 获取 HML 骨骼方向
 */
function getHMLDirection(motionFrame, hmlIdx) {
  const childIdx = HML_CHILD_MAP[hmlIdx]
  
  if (childIdx === undefined) {
    return new THREE.Vector3(0, 1, 0)
  }
  
  const startPos = motionFrame[hmlIdx]
  const endPos = motionFrame[childIdx]
  
  const dir = new THREE.Vector3(
    endPos[0] - startPos[0],
    endPos[1] - startPos[1],
    endPos[2] - startPos[2]
  )
  
  if (dir.length() < 0.0001) {
    return new THREE.Vector3(0, 1, 0)
  }
  
  return dir.normalize()
}

/**
 * 特殊处理 Hips：使用三点构建局部坐标系（带重力对齐正交化）
 * 核心修改：强制 Y 轴永远垂直向上，防止全身倾斜
 */
function computeHipsRotation(motionFrame, vrm) {
  // HML 数据
  const leftUpperLegPos = motionFrame[2]   // leftUpperLeg
  const rightUpperLegPos = motionFrame[1]  // rightUpperLeg
  
  // HML 原始方向
  const rawX = new THREE.Vector3(
    rightUpperLegPos[0] - leftUpperLegPos[0],
    rightUpperLegPos[1] - leftUpperLegPos[1],
    rightUpperLegPos[2] - leftUpperLegPos[2]
  )
  
  // 关键修改：强制 Y 轴为世界绝对向上 (0, 1, 0)，防止全身倾斜
  const vY = new THREE.Vector3(0, 1, 0)
  
  // Z = rawX × vY
  const vZ = new THREE.Vector3().crossVectors(rawX, vY).normalize()
  
  // X = vY × Z
  const vX = new THREE.Vector3().crossVectors(vY, vZ).normalize()
  
  // 构建 HML 矩阵
  const hmlMatrix = new THREE.Matrix4().makeBasis(vX, vY, vZ)
  
  // VRM T-Pose 坐标系（同样处理）
  const hipsNode = vrm.humanoid.getNormalizedBoneNode('hips')
  const leftUpperLegNode = vrm.humanoid.getNormalizedBoneNode('leftUpperLeg')
  const rightUpperLegNode = vrm.humanoid.getNormalizedBoneNode('rightUpperLeg')
  
  const vrmLeftUpperLegPos = new THREE.Vector3()
  const vrmRightUpperLegPos = new THREE.Vector3()
  leftUpperLegNode.getWorldPosition(vrmLeftUpperLegPos)
  rightUpperLegNode.getWorldPosition(vrmRightUpperLegPos)
  
  const vrmRawX = new THREE.Vector3().subVectors(vrmRightUpperLegPos, vrmLeftUpperLegPos)
  const vrmVY = new THREE.Vector3(0, 1, 0)
  const vrmVZ = new THREE.Vector3().crossVectors(vrmRawX, vrmVY).normalize()
  const vrmVX = new THREE.Vector3().crossVectors(vrmVY, vrmVZ).normalize()
  
  // 构建 VRM 矩阵
  const vrmMatrix = new THREE.Matrix4().makeBasis(vrmVX, vrmVY, vrmVZ)
  
  // 计算旋转
  const quat = new THREE.Quaternion().setFromRotationMatrix(
    vrmMatrix.invert().multiply(hmlMatrix)
  )
  
  return quat
}

/**
 * 特殊处理 UpperChest：使用多个子骨骼方向
 */
function computeUpperChestRotation(motionFrame, vrm, appliedRotations) {
  // HML 数据
  const upperChestIdx = VRM_TO_HML['upperChest']
  const neckIdx = 12
  const leftShoulderIdx = 14
  const rightShoulderIdx = 13
  
  const upperChestPos = motionFrame[upperChestIdx]
  const neckPos = motionFrame[neckIdx]
  const leftShoulderPos = motionFrame[leftShoulderIdx]
  const rightShoulderPos = motionFrame[rightShoulderIdx]
  
  // 使用 neck 方向作为主方向
  const hmlDir = new THREE.Vector3(
    neckPos[0] - upperChestPos[0],
    neckPos[1] - upperChestPos[1],
    neckPos[2] - upperChestPos[2]
  ).normalize()
  
  // VRM T-Pose 方向
  const vrmDir = vrmTPoseDirs['upperChest']
  
  // 计算世界旋转
  const qWorld = new THREE.Quaternion().setFromUnitVectors(vrmDir, hmlDir)
  
  // 获取父骨骼（chest）的世界旋转
  const chestNode = vrm.humanoid.getNormalizedBoneNode('chest')
  let qParent = new THREE.Quaternion(0, 0, 0, 1)
  if (chestNode && appliedRotations['chest']) {
    qParent = appliedRotations['chest'].clone()
  }
  
  // 世界旋转 → 局部旋转
  const qLocal = qParent.clone().invert().multiply(qWorld)
  
  return qLocal
}

/**
 * 应用一帧动作到 VRM
 */
export function applyMotionFrame(motionFrame, vrm) {
  if (!vrm || !vrm.humanoid) return
  
  if (Object.keys(vrmTPoseDirs).length === 0) {
    console.warn('[applyMotionFrame] 请先调用 captureVRMDirs()')
    return
  }
  
  // 存储每个骨骼的世界旋转
  const worldRotations = {}
  
  // ========== Step 1: 计算所有骨骼的局部旋转 ==========
  // 先重置所有骨骼旋转为单位四元数
  BONE_ORDER.forEach(vrmBoneName => {
    const boneNode = vrm.humanoid.getNormalizedBoneNode(vrmBoneName)
    if (boneNode) {
      boneNode.quaternion.set(0, 0, 0, 1)
    }
  })
  
  // 第一遍：计算并应用非分叉点骨骼
  BONE_ORDER.forEach(vrmBoneName => {
    const config = Object.values(BONE_CONFIG).find(c => c.vrm === vrmBoneName)
    if (!config) return
    
    // 跳过 Hips 和 UpperChest（特殊处理）
    if (vrmBoneName === 'hips' || vrmBoneName === 'upperChest') return
    
    // 跳过 Hand（保持父关节方向）
    if (vrmBoneName === 'leftHand' || vrmBoneName === 'rightHand') return
    
    const hmlIdx = VRM_TO_HML[vrmBoneName]
    if (hmlIdx === undefined) return
    
    const hmlDir = getHMLDirection(motionFrame, hmlIdx)
    const vrmDir = vrmTPoseDirs[vrmBoneName]
    if (!vrmDir) return
    
    // 获取父骨骼的世界旋转
    const parentBoneName = VRM_PARENT_MAP[vrmBoneName]
    let qParent = new THREE.Quaternion(0, 0, 0, 1)
    if (parentBoneName && worldRotations[parentBoneName]) {
      qParent = worldRotations[parentBoneName].clone()
    }
    
    // 计算世界旋转
    const qWorld = new THREE.Quaternion().setFromUnitVectors(vrmDir, hmlDir)
    
    // 世界旋转 → 局部旋转
    const qLocal = qParent.clone().invert().multiply(qWorld)
    
    // 应用旋转
    const boneNode = vrm.humanoid.getNormalizedBoneNode(vrmBoneName)
    if (boneNode) {
      boneNode.quaternion.copy(qLocal)
    }
    
    // 计算世界旋转并保存
    const finalWorldQuat = qLocal.clone().multiply(qParent)
    worldRotations[vrmBoneName] = finalWorldQuat
  })
  
  // ========== Step 2: Hand 保持父关节方向 ==========
  // leftHand 继承 leftLowerArm 的旋转
  // rightHand 继承 rightLowerArm 的旋转
  const leftLowerArmNode = vrm.humanoid.getNormalizedBoneNode('leftLowerArm')
  const leftHandNode = vrm.humanoid.getNormalizedBoneNode('leftHand')
  if (leftLowerArmNode && leftHandNode) {
    leftHandNode.quaternion.copy(leftLowerArmNode.quaternion)
  }
  
  const rightLowerArmNode = vrm.humanoid.getNormalizedBoneNode('rightLowerArm')
  const rightHandNode = vrm.humanoid.getNormalizedBoneNode('rightHand')
  if (rightLowerArmNode && rightHandNode) {
    rightHandNode.quaternion.copy(rightLowerArmNode.quaternion)
  }
  
  // ========== Step 3: 特殊处理 Hips ==========
  const hipsQuat = computeHipsRotation(motionFrame, vrm)
  const hipsNode = vrm.humanoid.getNormalizedBoneNode('hips')
  if (hipsNode) {
    hipsNode.quaternion.copy(hipsQuat)
    
    // 添加位移处理：设置 hips 位置
    const hipsPos = motionFrame[0]
    hipsNode.position.set(hipsPos[0], hipsPos[1], hipsPos[2])
    hipsNode.updateMatrixWorld(true)
  }
  worldRotations['hips'] = hipsQuat.clone()
  
  // ========== Step 3: 特殊处理 UpperChest ==========
  const upperChestQuat = computeUpperChestRotation(motionFrame, vrm, worldRotations)
  const upperChestNode = vrm.humanoid.getNormalizedBoneNode('upperChest')
  if (upperChestNode) {
    upperChestNode.quaternion.copy(upperChestQuat)
  }
  // 计算 UpperChest 的世界旋转
  const chestNode = vrm.humanoid.getNormalizedBoneNode('chest')
  let chestWorldQuat = new THREE.Quaternion(0, 0, 0, 1)
  if (chestNode) {
    chestWorldQuat = chestNode.quaternion.clone()
  }
  const upperChestWorldQuat = upperChestQuat.clone().multiply(chestWorldQuat)
  worldRotations['upperChest'] = upperChestWorldQuat
  
  // ========== Step 4: 打印调试信息 ==========
  console.log('========== 骨骼旋转调试 ==========')
  
  BONE_ORDER.forEach(vrmBoneName => {
    const config = Object.values(BONE_CONFIG).find(c => c.vrm === vrmBoneName)
    if (!config) return
    
    const hmlIdx = VRM_TO_HML[vrmBoneName]
    if (hmlIdx === undefined) return
    
    const hmlDir = getHMLDirection(motionFrame, hmlIdx)
    const vrmDir = vrmTPoseDirs[vrmBoneName]
    if (!vrmDir) return
    
    const boneNode = vrm.humanoid.getNormalizedBoneNode(vrmBoneName)
    if (!boneNode) return
    
    // 计算转换后的方向
    const worldQuat = worldRotations[vrmBoneName]
    let afterDir = null
    if (worldQuat) {
      afterDir = vrmDir.clone().applyQuaternion(worldQuat)
    }
    
    console.log(`=== ${vrmBoneName} ===`)
    console.log(`  HML方向: [${hmlDir.x.toFixed(4)}, ${hmlDir.y.toFixed(4)}, ${hmlDir.z.toFixed(4)}]`)
    console.log(`  T-Pose方向: [${vrmDir.x.toFixed(4)}, ${vrmDir.y.toFixed(4)}, ${vrmDir.z.toFixed(4)}]`)
    if (afterDir) {
      console.log(`  转换后: [${afterDir.x.toFixed(4)}, ${afterDir.y.toFixed(4)}, ${afterDir.z.toFixed(4)}]`)
    }
  })
  
  console.log('=====================================')
  
  vrm.update(0)
}

// 导出单例方法
window.hmlToVrm = {
  captureVRMDirs,
  applyMotionFrame,
}

/**
 * 获取 HML 骨骼方向
 */
export function getHMLBoneDirection(motionFrame, vrmBoneName) {
  const hmlIdx = VRM_TO_HML[vrmBoneName]
  if (hmlIdx === undefined) return null
  return getHMLDirection(motionFrame, hmlIdx)
}

/**
 * 获取 VRM 当前骨骼方向
 */
export function getVRMBoneDirection(vrm, vrmBoneName) {
  const config = Object.values(BONE_CONFIG).find(c => c.vrm === vrmBoneName)
  if (!config) return null
  
  const boneNode = vrm.humanoid.getNormalizedBoneNode(vrmBoneName)
  if (!boneNode) return null
  
  if (!config.child) {
    return new THREE.Vector3(0, 1, 0)
  }
  
  const childNode = vrm.humanoid.getNormalizedBoneNode(config.child)
  if (!childNode) return null
  
  const startPos = new THREE.Vector3()
  const endPos = new THREE.Vector3()
  boneNode.getWorldPosition(startPos)
  childNode.getWorldPosition(endPos)
  
  return endPos.clone().sub(startPos).normalize()
}
