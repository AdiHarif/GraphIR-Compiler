
import * as ir from "graphir";

import * as ins from "./llvm_instructions/instruction";

const numericOperatorsMap = new Map<ir.BinaryOperation, ins.LlvmNumericOperation>([
    [ir.BinaryOperation.Add, ins.LlvmNumericOperation.Add],
    [ir.BinaryOperation.Sub, ins.LlvmNumericOperation.Sub],
    [ir.BinaryOperation.Mul, ins.LlvmNumericOperation.Mul],
    [ir.BinaryOperation.Div, ins.LlvmNumericOperation.Div],
]);

const bitwiseOperatorsMap = new Map<ir.BinaryOperation, ins.LlvmNumericOperation>([
    [ir.BinaryOperation.ArithmeticRightShift, ins.LlvmNumericOperation.ARShift],
    [ir.BinaryOperation.LogicalRightShift, ins.LlvmNumericOperation.LRShift]
]);

const comparisonOperatorsMap = new Map<ir.BinaryOperation, ins.LlvmCondition>([
    [ir.BinaryOperation.EqualEqual, ins.LlvmCondition.Eq],
    [ir.BinaryOperation.NotEqual, ins.LlvmCondition.Ne]
]);

export class InstructionGenVisitor implements ir.VertexVisitor<Array<ins.Instruction>> {
    constructor(private readonly namesMap: Map<ir.Vertex, ins.NamedValue>) { }

    private isBlockStart(vertex: ir.ControlVertex): boolean {
        return vertex.inEdges.filter(e => e.source instanceof ir.BranchVertex).length > 0;
    }

    private isBlockEnd(vertex: ir.ControlVertex): boolean {
        return vertex instanceof ir.NonTerminalControlVertex && vertex.next instanceof ir.MergeVertex;
    }

    private wrapBlockBounderies(vertex: ir.ControlVertex, instructions: Array<ins.Instruction>): Array<ins.Instruction> {
        let out = [...instructions];
        if (this.isBlockStart(vertex)) {
            const labelInstruction = new ins.LabelInstruction(this.namesMap.get(vertex)!);
            out = [labelInstruction, ...out];
        }
        if (this.isBlockEnd(vertex)) {
            const jumpInstruction = new ins.JumpInstruction(this.namesMap.get((vertex as ir.NonTerminalControlVertex).next!)!);
            out.push(jumpInstruction);
        }
        return out;
    }

    visitLiteralVertex(vertex: ir.LiteralVertex): Array<ins.Instruction> {
        const instruction = new ins.BinaryOperationInstruction(
            this.namesMap.get(vertex)!,
            ins.LlvmType.F64,
            ins.LlvmNumericOperation.Add,
            0,
            (vertex.value as number)!
        );
        return [instruction];
    }

    visitSymbolVertex(vertex: ir.SymbolVertex): Array<ins.Instruction> {
        return [];
    }

    visitParameterVertex(vertex: ir.ParameterVertex): Array<ins.Instruction> {
        return [];
    }

    visitPrefixUnaryOperationVertex(vertex: ir.PrefixUnaryOperationVertex): Array<ins.Instruction> {
        throw new Error("Method not implemented.");
    }

    visitPostfixUnaryOperationVertex(vertex: ir.PostfixUnaryOperationVertex): Array<ins.Instruction> {
        throw new Error("Method not implemented.");
    }

    visitBinaryOperationVertex(vertex: ir.BinaryOperationVertex): Array<ins.Instruction> {
        const op = vertex.operator as ir.BinaryOperation;
        const out = [];
        if (numericOperatorsMap.has(op)) {
            out.push(new ins.BinaryOperationInstruction(
                this.namesMap.get(vertex)!,
                ins.LlvmType.F64,
                numericOperatorsMap.get(op)!,
                this.namesMap.get(vertex.left!)!,
                this.namesMap.get(vertex.right!)!
            ));
        }
        else if (comparisonOperatorsMap.has(op)) {
            out.push(new ins.ComparisonInstruction(
                this.namesMap.get(vertex)!,
                comparisonOperatorsMap.get(op)!,
                this.namesMap.get(vertex.left!)!,
                this.namesMap.get(vertex.right!)!
            ));
        }
        else if (bitwiseOperatorsMap.has(op)) {
            const tmpReg0 = `${this.namesMap.get(vertex)!}.0`;
            const tmpReg1 = `${this.namesMap.get(vertex)!}.1`;
            const tmpReg2 = `${this.namesMap.get(vertex)!}.2`;
            const castLeft = new ins.CastInstruction(
                tmpReg0,
                ins.LlvmCastOperation.FpToSi,
                ins.LlvmType.F64,
                this.namesMap.get(vertex.left!)!,
                ins.LlvmType.I64
            );
            const castRight = new ins.CastInstruction(
                tmpReg1,
                ins.LlvmCastOperation.FpToSi,
                ins.LlvmType.F64,
                this.namesMap.get(vertex.right!)!,
                ins.LlvmType.I64
            );
            const operation = new ins.BinaryOperationInstruction(
                tmpReg2,
                ins.LlvmType.I64,
                bitwiseOperatorsMap.get(op)!,
                tmpReg0,
                tmpReg1
            );
            const castOut = new ins.CastInstruction(
                this.namesMap.get(vertex)!,
                ins.LlvmCastOperation.SiToFp,
                ins.LlvmType.I64,
                tmpReg2,
                ins.LlvmType.F64
            );
            out.push(castLeft, castRight, operation, castOut);
        }
        else {
            throw new Error(`Unsupported binary operation ${op}`);
        }
        return out;
    }

    visitPhiVertex(vertex: ir.PhiVertex): Array<ins.Instruction> {
        const operands = vertex.operands.map(operand =>
            [
                this.namesMap.get(operand.value)!,
                this.namesMap.get(operand.srcBranch)!,
            ]
        );
        const instruction = new ins.PhiInstruction(
            this.namesMap.get(vertex)!,
            ins.LlvmType.F64,
            operands as Array<[ins.Value, ins.Label]>
        );
        return [instruction];
    }

    visitStartVertex(vertex: ir.StartVertex): Array<ins.Instruction> {
        return [];
    }

    visitPassVertex(vertex: ir.PassVertex): Array<ins.Instruction> {
        return this.wrapBlockBounderies(vertex, []);

    }

    visitReturnVertex(vertex: ir.ReturnVertex): Array<ins.Instruction> {
        //TODO: support void return
        const instruction = new ins.ReturnInstruction(
            ins.LlvmType.F64,
            this.namesMap.get(vertex.value!)!
        );
        return this.wrapBlockBounderies(vertex, [instruction]);
    }

    visitBranchVertex(vertex: ir.BranchVertex): Array<ins.Instruction> {
        const instruction = new ins.BranchInstruction(
            this.namesMap.get(vertex.condition!)!,
            this.namesMap.get(vertex.trueNext!)!,
            this.namesMap.get(vertex.falseNext!)!
        );
        return this.wrapBlockBounderies(vertex, [instruction]);
    }

    visitMergeVertex(vertex: ir.MergeVertex): Array<ins.Instruction> {
        const instruction = new ins.LabelInstruction(this.namesMap.get(vertex)!);
        return this.wrapBlockBounderies(vertex, [instruction]);
    }

    visitAllocationVertex(vertex: ir.AllocationVertex): Array<ins.Instruction> {
        throw new Error("Method not implemented.");
    }

    visitStoreVertex(vertex: ir.StoreVertex): Array<ins.Instruction> {
        throw new Error("Method not implemented.");
    }

    visitLoadVertex(vertex: ir.LoadVertex): Array<ins.Instruction> {
        throw new Error("Method not implemented.");
    }

    visitCallVertex(vertex: ir.CallVertex): Array<ins.Instruction> {
        throw new Error("Method not implemented.");
    }
}